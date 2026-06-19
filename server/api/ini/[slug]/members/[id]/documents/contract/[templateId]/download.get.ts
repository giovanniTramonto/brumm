import { prisma } from '~/server/utils/prisma'
import { s3GetPresignedUrl } from '~/server/utils/storage/s3/files'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')
  const templateId = getRouterParam(event, 'templateId')

  if (!memberId || !templateId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  if (currentUser.role !== 'SUPERUSER' && currentUser.role !== 'TEAM') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const submission = await prisma.memberDocument.findUnique({
    where: { memberId_templateId: { memberId, templateId } },
  })
  if (!submission?.s3Key) {
    throw createError({ statusCode: 404, statusMessage: 'Dokument nicht gefunden' })
  }

  const url = await s3GetPresignedUrl(club.id, submission.s3Key)
  return sendRedirect(event, url, 302)
})
