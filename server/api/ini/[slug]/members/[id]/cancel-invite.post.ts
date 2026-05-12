import { deleteMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const canManageMembers = currentUser.role === 'SUPERUSER' || (currentUser.role === 'MANAGER' && currentUser.isMemberManager)
  if (!canManageMembers) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const user = await prisma.user.findFirst({
    where: { id: memberId, clubId: club.id },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  if (user.isActive) {
    throw createError({ statusCode: 409, statusMessage: 'Aktive Mitglieder können nicht so abgemeldet werden' })
  }

  await deleteMemberData(memberId, club)

  await prisma.invite.deleteMany({ where: { userId: memberId } })
  await prisma.magicLink.deleteMany({ where: { userId: memberId } })
  await prisma.userEmail.deleteMany({ where: { userId: memberId } })
  await prisma.user.delete({ where: { id: memberId } })

  return { ok: true }
})
