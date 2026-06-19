import { prisma } from '~/server/utils/prisma'
import { getClubStorageType } from '~/server/utils/s3Client'
import { downloadDriveFile } from '~/server/utils/storage/googleDrive'
import { s3GetPresignedUrl } from '~/server/utils/storage/s3/files'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const fileId = getRouterParam(event, 'fileId')

  if (!fileId) throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })

  const document = await prisma.document.findFirst({ where: { id: fileId, clubId: club.id } })
  if (!document) throw createError({ statusCode: 404, statusMessage: 'Datei nicht gefunden' })

  if (document.s3Key && (await getClubStorageType(club.id)) === 'S3') {
    const url = await s3GetPresignedUrl(club.id, document.s3Key)
    return sendRedirect(event, url, 302)
  }

  const tokens = club.oauthToken as OAuthTokens
  const storageConfig = club.storageConfig as GoogleDriveConfig
  if (!storageConfig.documentsFolderId)
    throw createError({ statusCode: 404, statusMessage: 'Datei nicht gefunden' })

  // fileName may be null for docs created before the schema migration — fall back to display name
  const lookupName = document.fileName ?? document.name
  if (!lookupName) throw createError({ statusCode: 404, statusMessage: 'Datei nicht gefunden' })

  const { getDriveClientFromTokens } = await import('~/server/utils/googleAuth')
  const drive = getDriveClientFromTokens(tokens)
  const stripExt = (s: string) => s.replace(/\.[^.]+$/, '')
  const res = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `'${storageConfig.documentsFolderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
    fields: 'files(id, name)',
    pageSize: 1000,
  })
  const driveFiles = (res.data.files ?? []).map((f) => ({ id: f.id ?? '', name: f.name ?? '' }))
  const driveFile =
    driveFiles.find((f) => f.name === lookupName) ??
    driveFiles.find((f) => stripExt(f.name) === stripExt(lookupName))
  const driveFileId = driveFile?.id
  if (!driveFileId) throw createError({ statusCode: 404, statusMessage: 'Datei nicht gefunden' })

  const { buffer, filename, mimeType } = await downloadDriveFile({ tokens, fileId: driveFileId })
  setHeader(event, 'Content-Type', mimeType)
  setHeader(event, 'Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`)
  return buffer
})
