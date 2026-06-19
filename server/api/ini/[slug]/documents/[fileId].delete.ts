import { prisma } from '~/server/utils/prisma'
import { deleteDriveFile, findDriveFileByName } from '~/server/utils/storage/googleDrive'
import { s3DeleteFile } from '~/server/utils/storage/s3/files'
import type { GoogleDriveConfig, OAuthTokens } from '~/types'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const fileId = getRouterParam(event, 'fileId')

  if (currentUser.role !== 'SUPERUSER' && currentUser.role !== 'MANAGER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }
  if (!fileId) throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })

  const document = await prisma.document.findFirst({ where: { id: fileId, clubId: club.id } })
  if (!document) throw createError({ statusCode: 404, statusMessage: 'Dokument nicht gefunden' })

  if (document.fileName) {
    try {
      if (document.s3Key) {
        await s3DeleteFile(club.id, document.s3Key)
      } else {
        const tokens = club.oauthToken as OAuthTokens
        const storageConfig = club.storageConfig as GoogleDriveConfig
        if (storageConfig.documentsFolderId) {
          const { getDriveClientFromTokens } = await import('~/server/utils/googleAuth')
          const drive = getDriveClientFromTokens(tokens)
          const driveFileId = await findDriveFileByName(
            drive,
            storageConfig.documentsFolderId,
            document.fileName,
          )
          if (driveFileId) {
            await deleteDriveFile({ tokens, fileId: driveFileId })
          }
        }
      }
    } catch {
      // ignore if already deleted
    }
  }

  await prisma.document.delete({ where: { id: fileId } })

  return { ok: true }
})
