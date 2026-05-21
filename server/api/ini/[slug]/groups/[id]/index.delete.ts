import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const groupId = getRouterParam(event, 'id')

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  if (!groupId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const group = await prisma.group.findFirst({
    where: { id: groupId, clubId: club.id },
  })

  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Gruppe nicht gefunden' })
  }

  await prisma.group.delete({ where: { id: groupId } })

  return { ok: true }
})
