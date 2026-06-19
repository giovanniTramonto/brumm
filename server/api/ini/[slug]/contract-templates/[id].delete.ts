import { getDriveClientFromTokens } from '~/server/utils/googleAuth'
import { prisma } from '~/server/utils/prisma'
import { getClubStorageType } from '~/server/utils/s3Client'
import {
  findDriveFileByName,
  getOrCreateTemplateSubfolder,
} from '~/server/utils/storage/googleDrive'
import { s3DeleteByPrefix, s3DeleteFile } from '~/server/utils/storage/s3/files'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const templateId = getRouterParam(event, 'id')

  const canManage =
    currentUser.role === 'SUPERUSER' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)
  if (!canManage) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const template = await prisma.documentTemplate.findFirst({
    where: { id: templateId, clubId: club.id },
  })
  if (!template) {
    throw createError({ statusCode: 404, statusMessage: 'Vorlage nicht gefunden' })
  }

  if (club.isSetupDone && template.fileName) {
    try {
      if ((await getClubStorageType(club.id)) === 'S3') {
        if (template.s3Key) {
          await s3DeleteFile(club.id, template.s3Key)
        } else {
          await s3DeleteByPrefix(club.id, `contract-templates/${template.id}`)
        }
      } else {
        const tokens = club.oauthToken as OAuthTokens
        const storageConfig = club.storageConfig as GoogleDriveConfig
        const drive = getDriveClientFromTokens(tokens)
        if (storageConfig.templatesFolderId) {
          const subfolderId = await getOrCreateTemplateSubfolder({
            tokens,
            templatesFolderId: storageConfig.templatesFolderId,
            ref: template.ref,
          })
          const fileId = await findDriveFileByName(drive, subfolderId, template.fileName)
          if (fileId) await drive.files.delete({ fileId, supportsAllDrives: true })
          await drive.files.delete({ fileId: subfolderId, supportsAllDrives: true })
        }
      }
    } catch {
      // ignore storage errors on delete
    }
  }

  await prisma.documentTemplate.delete({ where: { id: templateId } })

  return { ok: true }
})
