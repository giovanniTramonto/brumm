import { prisma } from '~/server/utils/prisma'
import { s3DeleteByPrefix, s3DeleteFile } from '~/server/utils/storage/s3/files'

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

  try {
    if (template.s3Key) {
      await s3DeleteFile(club.id, template.s3Key)
    } else {
      await s3DeleteByPrefix(club.id, `contract-templates/${template.id}`)
    }
  } catch {
    // ignore storage errors on delete
  }

  await prisma.documentTemplate.delete({ where: { id: templateId } })

  return { ok: true }
})
