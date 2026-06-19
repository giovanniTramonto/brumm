import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createId } from '@paralleldrive/cuid2'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'
import { decrypt } from './encryption'
import { getDriveClientFromTokens } from './googleAuth'
import { getMemberData } from './memberData'
import { prisma } from './prisma'
import { invalidateS3Cache } from './s3Client'
import { downloadDriveFile, findDriveFileByName, listOtherDocuments } from './storage/googleDrive'
import { sanitizeFilename } from './storage/s3/files'

type S3Config = {
  endpoint?: string
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}

export type TransferEntry = {
  name: string
  source: string
  dest?: string
  status: 'transferred' | 'already_in_s3' | 'skipped' | 'failed'
  error?: string
}

type Section = { ok: number; failed: number; errors: string[]; log: TransferEntry[] }

export type TransferResult = {
  templates: Section
  memberDocs: Section
  wallDocs: Section
  otherDocs: Section
}

function makeSection(): Section {
  return { ok: 0, failed: 0, errors: [], log: [] }
}

async function uploadBuffer(
  client: S3Client,
  bucket: string,
  prefix: string,
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const uid = createId()
  const key = `${prefix}/${uid}/${sanitizeFilename(filename)}`
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType }),
  )
  return key
}

export async function transferDriveToS3(clubId: string): Promise<TransferResult> {
  const club = await prisma.club.findUniqueOrThrow({ where: { id: clubId } })
  const record = await prisma.clubFileStorage.findUniqueOrThrow({ where: { clubId } })

  if (!record.pendingEncryptedConfig) throw new Error('Keine ausstehende S3-Konfiguration')

  const config = JSON.parse(decrypt(record.pendingEncryptedConfig)) as S3Config
  const client = new S3Client({
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
  })
  const { bucket } = config
  const tokens = club.oauthToken as unknown as OAuthTokens
  const storageConfig = club.storageConfig as unknown as GoogleDriveConfig
  const drive = getDriveClientFromTokens(tokens)

  const result: TransferResult = {
    templates: makeSection(),
    memberDocs: makeSection(),
    wallDocs: makeSection(),
    otherDocs: makeSection(),
  }

  // 1. Contract template files
  const templates = await prisma.documentTemplate.findMany({ where: { clubId } })
  for (const template of templates) {
    if (template.s3Key) {
      result.templates.ok++
      result.templates.log.push({
        name: template.fileName ?? template.name,
        source: `s3:${template.s3Key}`,
        dest: template.s3Key,
        status: 'already_in_s3',
      })
      continue
    }
    if (!storageConfig.templatesFolderId) continue
    try {
      const { getOrCreateTemplateSubfolder, listFolderFiles } = await import(
        './storage/googleDrive'
      )
      const subfolderId = await getOrCreateTemplateSubfolder({
        tokens,
        templatesFolderId: storageConfig.templatesFolderId,
        ref: template.ref,
      })
      // If fileName is known, find by name; otherwise take the first file in the subfolder
      let fileId: string | null = null
      let resolvedFileName = template.fileName
      if (resolvedFileName) {
        fileId = await findDriveFileByName(drive, subfolderId, resolvedFileName)
      } else {
        const files = await listFolderFiles(drive, subfolderId)
        if (files.length > 0) {
          fileId = files[0].id ?? null
          resolvedFileName = files[0].name ?? null
        }
      }
      if (!fileId || !resolvedFileName) throw new Error('Datei nicht in Drive gefunden')
      const { buffer, mimeType } = await downloadDriveFile({ tokens, fileId })
      const key = await uploadBuffer(
        client,
        bucket,
        `contract-templates/${template.id}`,
        buffer,
        mimeType,
        resolvedFileName,
      )
      await prisma.documentTemplate.update({
        where: { id: template.id },
        data: { s3Key: key, fileName: resolvedFileName },
      })
      result.templates.ok++
      result.templates.log.push({
        name: resolvedFileName,
        source: `drive:${fileId}`,
        dest: `contract-templates/${template.id}/<uid>/${resolvedFileName}`,
        status: 'transferred',
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      result.templates.failed++
      result.templates.errors.push(`${template.name}: ${error}`)
      result.templates.log.push({
        name: template.fileName ?? template.name,
        source: `drive:ref=${template.ref}`,
        dest: `contract-templates/${template.id}/<uid>/${template.fileName ?? '?'}`,
        status: 'failed',
        error,
      })
    }
  }

  // 2. Member contract document submissions
  const memberDocs = await prisma.memberDocument.findMany({
    where: { member: { clubId } },
    include: { template: { select: { fileName: true, ref: true } } },
  })
  const memberIds = [...new Set(memberDocs.map((d) => d.memberId))]
  const memberDataMap = new Map<string, Awaited<ReturnType<typeof getMemberData>>>()
  await Promise.all(
    memberIds.map(async (memberId) => {
      const md = await getMemberData(memberId, club)
      if (md) memberDataMap.set(memberId, md)
    }),
  )

  for (const doc of memberDocs) {
    const s3Prefix = `members/${doc.memberId}/contract`

    if (doc.s3Key) {
      result.memberDocs.ok++
      result.memberDocs.log.push({
        name: doc.fileName ?? doc.template.fileName ?? doc.id,
        source: `s3:${doc.s3Key}`,
        dest: doc.s3Key,
        status: 'already_in_s3',
      })
      continue
    }

    const md = memberDataMap.get(doc.memberId)
    if (!md?.storageRef) continue

    // Resolve filename: doc.fileName → template.fileName → Drive template subfolder listing
    // (old records have null fileName because only driveFileId was stored before migration)
    let resolvedFileName = doc.fileName ?? doc.template.fileName
    if (!resolvedFileName && storageConfig.templatesFolderId) {
      try {
        const { getOrCreateTemplateSubfolder, listFolderFiles } = await import(
          './storage/googleDrive'
        )
        const subfolderId = await getOrCreateTemplateSubfolder({
          tokens,
          templatesFolderId: storageConfig.templatesFolderId,
          ref: doc.template.ref,
        })
        const files = await listFolderFiles(drive, subfolderId)
        if (files.length > 0) resolvedFileName = files[0].name
      } catch {
        // resolvedFileName stays null; will be counted as failed below
      }
    }

    const displayName = resolvedFileName ?? doc.id
    const dest = `${s3Prefix}/<uid>/${displayName}`

    if (!resolvedFileName) {
      result.memberDocs.failed++
      result.memberDocs.errors.push(`doc ${doc.id}: Dateiname nicht ermittelbar`)
      result.memberDocs.log.push({
        name: displayName,
        source: `drive:member=${doc.memberId}`,
        dest,
        status: 'failed',
        error: 'Dateiname nicht ermittelbar',
      })
      continue
    }

    try {
      const { findMemberContractFileId } = await import('./storage/googleDrive')
      const fileId = await findMemberContractFileId({
        tokens,
        membersFolderId: storageConfig.membersFolderId,
        storageRef: md.storageRef,
        fileName: resolvedFileName,
      })
      if (!fileId) throw new Error('Datei nicht in Drive gefunden')
      const { buffer, mimeType } = await downloadDriveFile({ tokens, fileId })
      const key = await uploadBuffer(client, bucket, s3Prefix, buffer, mimeType, resolvedFileName)
      await prisma.memberDocument.update({
        where: { id: doc.id },
        data: { s3Key: key, fileName: resolvedFileName },
      })
      result.memberDocs.ok++
      result.memberDocs.log.push({
        name: resolvedFileName,
        source: `drive:${fileId}`,
        dest,
        status: 'transferred',
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      result.memberDocs.failed++
      result.memberDocs.errors.push(`doc ${doc.id}: ${error}`)
      result.memberDocs.log.push({
        name: displayName,
        source: `drive:member=${doc.memberId}`,
        dest,
        status: 'failed',
        error,
      })
    }
  }

  // 3. Club wall documents
  const wallDocs = await prisma.document.findMany({ where: { clubId, type: 'document' } })
  const stripExt = (s: string) => s.replace(/\.[^.]+$/, '')

  // List folder once to enable extension-insensitive fallback matching
  let driveWallFiles: { id: string; name: string }[] = []
  if (storageConfig.documentsFolderId) {
    const res = await drive.files.list({
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      q: `'${storageConfig.documentsFolderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: 'files(id, name)',
      pageSize: 1000,
    })
    driveWallFiles = (res.data.files ?? []).map((f) => ({ id: f.id ?? '', name: f.name ?? '' }))
  }

  for (const doc of wallDocs) {
    if (doc.s3Key) {
      result.wallDocs.ok++
      result.wallDocs.log.push({
        name: doc.name,
        source: `s3:${doc.s3Key}`,
        dest: doc.s3Key,
        status: 'already_in_s3',
      })
      continue
    }
    if (!storageConfig.documentsFolderId) continue
    // fileName may be null for docs created before the schema migration (only driveFileId was stored then)
    const lookupName = doc.fileName ?? doc.name
    if (!lookupName) continue
    try {
      // exact match first, then extension-stripped fallback
      const driveFile =
        driveWallFiles.find((f) => f.name === lookupName) ??
        driveWallFiles.find((f) => stripExt(f.name) === stripExt(lookupName))
      if (!driveFile) throw new Error('Datei nicht in Drive gefunden')
      const { buffer, filename, mimeType } = await downloadDriveFile({
        tokens,
        fileId: driveFile.id,
      })
      const dest = `documents/<uid>/${filename}`
      const key = await uploadBuffer(client, bucket, 'documents', buffer, mimeType, filename)
      await prisma.document.update({
        where: { id: doc.id },
        data: { s3Key: key, fileName: filename },
      })
      result.wallDocs.ok++
      result.wallDocs.log.push({
        name: doc.name,
        source: `drive:${driveFile.id}`,
        dest,
        status: 'transferred',
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      result.wallDocs.failed++
      result.wallDocs.errors.push(`doc ${doc.id}: ${error}`)
      result.wallDocs.log.push({
        name: doc.name,
        source: `drive:documents/${lookupName}`,
        dest: `documents/<uid>/${lookupName}`,
        status: 'failed',
        error,
      })
    }
  }

  // 4. Member "other" documents (no DB record — listed from Drive, uploaded to S3)
  if (storageConfig.membersFolderId) {
    const allMembers = await prisma.user.findMany({ where: { clubId, role: 'MEMBER' } })
    for (const member of allMembers) {
      const md = memberDataMap.get(member.id) ?? (await getMemberData(member.id, club))
      if (!md?.storageRef) continue
      try {
        const otherDocs = await listOtherDocuments({
          tokens,
          membersFolderId: storageConfig.membersFolderId,
          storageRef: md.storageRef,
        })
        for (const otherDoc of otherDocs) {
          const s3Prefix = `members/${member.id}/other`
          const dest = `${s3Prefix}/<uid>/${otherDoc.name ?? otherDoc.id}`
          try {
            const { buffer, filename, mimeType } = await downloadDriveFile({
              tokens,
              fileId: otherDoc.id,
            })
            const key = await uploadBuffer(client, bucket, s3Prefix, buffer, mimeType, filename)
            result.otherDocs.ok++
            result.otherDocs.log.push({
              name: filename,
              source: `drive:${otherDoc.id}`,
              dest: key,
              status: 'transferred',
            })
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err)
            result.otherDocs.failed++
            result.otherDocs.errors.push(`${md.storageRef}/${otherDoc.id}: ${error}`)
            result.otherDocs.log.push({
              name: otherDoc.name ?? otherDoc.id,
              source: `drive:${otherDoc.id}`,
              dest,
              status: 'failed',
              error,
            })
          }
        }
      } catch (err) {
        result.otherDocs.failed++
        result.otherDocs.errors.push(
          `listing ${md.storageRef}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
  }

  // Activate S3
  await prisma.clubFileStorage.update({
    where: { clubId },
    data: {
      type: 'S3',
      encryptedConfig: record.pendingEncryptedConfig,
      pendingEncryptedConfig: null,
    },
  })
  invalidateS3Cache(clubId)

  return result
}
