import { prisma } from '~/server/utils/prisma'
import { downloadDriveFile, getOrCreateTemplateSubfolder } from '~/server/utils/storage/googleDrive'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const templateId = getRouterParam(event, 'id')

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const template = await prisma.documentTemplate.findFirst({ where: { id: templateId, clubId: club.id } })
  if (!template) {
    throw createError({ statusCode: 404, statusMessage: 'Vorlage nicht gefunden' })
  }

  if (club.isSetupDone && template.driveFileId) {
    try {
      const tokens = club.oauthToken as OAuthTokens
      const storageConfig = club.storageConfig as GoogleDriveConfig
      const drive = (await import('~/server/utils/googleAuth')).getDriveClientFromTokens(tokens)
      await drive.files.delete({ fileId: template.driveFileId, supportsAllDrives: true })
      const folderId = await getOrCreateTemplateSubfolder({
        tokens,
        appFolderId: storageConfig.appFolderId,
        ref: template.ref,
      })
      await drive.files.delete({ fileId: folderId, supportsAllDrives: true })
    } catch {
      // ignore Drive errors on delete
    }
  }

  await prisma.documentTemplate.delete({ where: { id: templateId } })

  return { ok: true }
})
