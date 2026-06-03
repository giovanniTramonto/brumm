import { updateMemberData } from '~/server/utils/memberData'
import { assertValidTransition } from '~/server/utils/memberStatus'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const canManageMembers =
    currentUser.role === 'SUPERUSER' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)
  if (!canManageMembers) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const member = await prisma.user.findFirst({
    where: { id: memberId, clubId: club.id },
  })

  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  assertValidTransition(member.status, 'DEACTIVATED')

  const now = new Date()

  const updated = await prisma.user.update({
    where: { id: memberId },
    data: { status: 'DEACTIVATED', deactivatedAt: now },
  })

  await prisma.session.deleteMany({ where: { userId: memberId } })

  await updateMemberData(memberId, { lastEditedAt: now.toISOString(), lastEditedBy: 'Admin' }, club)

  return { member: updated }
})
