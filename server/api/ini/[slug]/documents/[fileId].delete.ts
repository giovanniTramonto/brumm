import { prisma } from '~/server/utils/prisma'
import { s3DeleteFile } from '~/server/utils/storage/s3/files'

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

  if (document.s3Key) {
    try {
      await s3DeleteFile(club.id, document.s3Key)
    } catch {
      // ignore if already deleted
    }
  }

  await prisma.document.delete({ where: { id: fileId } })

  return { ok: true }
})
