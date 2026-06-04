import { prisma } from '~/server/utils/prisma'
import { deleteDriveFile } from '~/server/utils/storage/googleDrive'
import type { OAuthTokens } from '~/types'

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

  if (document.driveFileId) {
    try {
      await deleteDriveFile({
        tokens: club.oauthToken as OAuthTokens,
        fileId: document.driveFileId,
      })
    } catch {
      // ignore if already deleted
    }
  }

  await prisma.document.delete({ where: { id: fileId } })

  return { ok: true }
})
