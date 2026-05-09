import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const userIds = (
    await prisma.user.findMany({ where: { clubId: club.id }, select: { id: true } })
  ).map((u) => u.id)

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { clubId: club.id } }),
    prisma.magicLink.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.invite.deleteMany({ where: { clubId: club.id } }),
    prisma.userEmail.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { clubId: club.id } }),
    prisma.group.deleteMany({ where: { clubId: club.id } }),
    prisma.club.delete({ where: { id: club.id } }),
  ])

  deleteCookie(event, 'session_token')

  return { ok: true }
})
