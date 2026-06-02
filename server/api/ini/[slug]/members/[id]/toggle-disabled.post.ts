import { updateMemberData } from '~/server/utils/memberData'
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

  if (!user.isActive) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Nur aktive Mitglieder können deaktiviert werden',
    })
  }

  const now = new Date().toISOString()
  const newDisabled = !user.isDisabled

  const updated = await prisma.user.update({
    where: { id: memberId },
    data: { isDisabled: newDisabled },
  })

  await updateMemberData(memberId, { lastEditedAt: now, lastEditedBy: 'Admin' }, club)

  return { member: updated }
})
