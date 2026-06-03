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

  const user = await prisma.user.findFirst({
    where: { id: memberId, clubId: club.id },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  const now = new Date().toISOString()
  const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  assertValidTransition(user.status, newStatus)

  const updated = await prisma.user.update({
    where: { id: memberId },
    data: { status: newStatus },
  })

  await updateMemberData(memberId, { lastEditedAt: now, lastEditedBy: 'Admin' }, club)

  return { member: updated }
})
