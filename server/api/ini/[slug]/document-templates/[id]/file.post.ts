import { prisma } from '~/server/utils/prisma'
import { uploadTemplateFile } from '~/server/utils/storage/googleDrive'
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

  const tokens = club.oauthToken as OAuthTokens
  const storageConfig = club.storageConfig as GoogleDriveConfig

  if (template.driveFileId) {
    try {
      const drive = (await import('~/server/utils/googleAuth')).getDriveClientFromTokens(tokens)
      await drive.files.delete({ fileId: template.driveFileId, supportsAllDrives: true })
    } catch {
      // ignore
    }
  }

  const result = await uploadTemplateFile({
    tokens,
    appFolderId: storageConfig.appFolderId,
    ref: template.ref,
    filename: filePart.filename,
    mimeType: filePart.type ?? 'application/octet-stream',
    buffer: filePart.data,
  })

  const updated = await prisma.documentTemplate.update({
    where: { id: templateId },
    data: { driveFileId: result.driveFileId, driveFileName: filePart.filename },
  })

  return { template: updated }
})
