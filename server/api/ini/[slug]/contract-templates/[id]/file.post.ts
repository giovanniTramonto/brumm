import { getDriveClientFromTokens } from '~/server/utils/googleAuth'
import { prisma } from '~/server/utils/prisma'
import { getClubStorageType } from '~/server/utils/s3Client'
import {
  findDriveFileByName,
  getOrCreateTemplateSubfolder,
  uploadTemplateFile,
} from '~/server/utils/storage/googleDrive'
import { s3DeleteFile, s3UploadFile } from '~/server/utils/storage/s3/files'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const templateId = getRouterParam(event, 'id')

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  if (!club.isSetupDone) {
    throw createError({ statusCode: 400, statusMessage: 'Storage nicht eingerichtet' })
  }

  const template = await prisma.documentTemplate.findFirst({
    where: { id: templateId, clubId: club.id },
  })
  if (!template) {
    throw createError({ statusCode: 404, statusMessage: 'Vorlage nicht gefunden' })
  }

  const formData = await readMultipartFormData(event)
  const filePart = formData?.find((p) => p.name === 'file')
  if (!filePart?.data || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: 'Keine Datei hochgeladen' })
  }

  let newS3Key: string | null = null

  if ((await getClubStorageType(club.id)) === 'S3') {
    if (template.s3Key) {
      try {
        await s3DeleteFile(club.id, template.s3Key)
      } catch {
        // ignore
      }
    }
    const result = await s3UploadFile(
      club.id,
      `contract-templates/${template.id}`,
      filePart.data,
      filePart.type ?? 'application/octet-stream',
      filePart.filename,
    )
    newS3Key = result.key
  } else {
    const tokens = club.oauthToken as OAuthTokens
    const storageConfig = club.storageConfig as GoogleDriveConfig
    if (!storageConfig.templatesFolderId)
      throw createError({ statusCode: 500, statusMessage: 'Templates-Ordner nicht konfiguriert' })

    if (template.fileName) {
      try {
        const drive = getDriveClientFromTokens(tokens)
        const subfolderId = await getOrCreateTemplateSubfolder({
          tokens,
          templatesFolderId: storageConfig.templatesFolderId,
          ref: template.ref,
        })
        const existingId = await findDriveFileByName(drive, subfolderId, template.fileName)
        if (existingId) {
          await drive.files.delete({ fileId: existingId, supportsAllDrives: true })
        }
      } catch {
        // ignore
      }
    }

    await uploadTemplateFile({
      tokens,
      templatesFolderId: storageConfig.templatesFolderId,
      ref: template.ref,
      filename: filePart.filename,
      mimeType: filePart.type ?? 'application/octet-stream',
      buffer: filePart.data,
    })
  }

  const updated = await prisma.documentTemplate.update({
    where: { id: templateId },
    data: { fileName: filePart.filename, s3Key: newS3Key },
  })

  return { template: updated }
})
