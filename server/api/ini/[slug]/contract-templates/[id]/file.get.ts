import { prisma } from '~/server/utils/prisma'
import { s3GetPresignedUrl } from '~/server/utils/storage/s3/files'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const templateId = getRouterParam(event, 'id')

  const template = await prisma.documentTemplate.findFirst({
    where: { id: templateId, clubId: club.id },
  })
  if (!template?.fileName || !template.s3Key) {
    throw createError({ statusCode: 404, statusMessage: 'Keine Vorlage hochgeladen' })
  }

  const url = await s3GetPresignedUrl(club.id, template.s3Key)
  return sendRedirect(event, url, 302)
})
