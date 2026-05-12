import { sendReactivationEmail } from '~/server/utils/email'
import { getMemberData, updateMemberData } from '~/server/utils/memberData'
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

  const user = await prisma.user.findFirst({ where: { id: memberId, clubId: club.id } })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  const updated = await prisma.user.update({
    where: { id: memberId },
    data: { isActive: true },
  })

  await updateMemberData(
    memberId,
    { isActive: true, deactivatedAt: undefined, deactivatedBy: undefined },
    club,
  )

  const md = await getMemberData(memberId, club)
  if (md) {
    await sendReactivationEmail({
      to: [md.email1, ...(md.email2 ? [md.email2] : [])],
      clubName: club.name,
      childName: `${md.firstName} ${md.lastName}`,
    })
  }

  return { member: updated }
})
