import { prisma } from '~/server/utils/prisma'
import { s3GetPresignedUrl } from '~/server/utils/storage/s3/files'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const fileId = getRouterParam(event, 'fileId')

  if (!fileId) throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })

  const document = await prisma.document.findFirst({ where: { id: fileId, clubId: club.id } })
  if (!document?.s3Key)
    throw createError({ statusCode: 404, statusMessage: 'Datei nicht gefunden' })

  const url = await s3GetPresignedUrl(club.id, document.s3Key)
  return sendRedirect(event, url, 302)
})
