import { sendDeactivationConfirmation, sendSuperUserNotification } from '~/server/utils/email'
import { getMemberData, updateMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const isSelf = currentUser.id === memberId
  const isSuperUser = currentUser.role === 'SUPERUSER'

  if (!isSelf && !isSuperUser) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const member = await prisma.user.findFirst({
    where: { id: memberId, clubId: club.id },
  })

  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  if (!member.isActive) {
    throw createError({ statusCode: 409, statusMessage: 'Mitglied bereits inaktiv' })
  }

  const memberData = await getMemberData(memberId, club)
  if (!memberData) {
    throw createError({ statusCode: 404, statusMessage: 'Mitgliedsdaten nicht gefunden' })
  }

  const deactivatedAt = new Date().toISOString()
  const deactivatedBy = isSelf ? 'self' : currentUser.id

  const updated = await prisma.user.update({
    where: { id: memberId },
    data: { isActive: false },
  })

  await prisma.session.deleteMany({ where: { userId: memberId } })

  await updateMemberData(memberId, { isActive: false, deactivatedAt, deactivatedBy }, club)

  const memberEmails = [memberData.email1, ...(memberData.email2 ? [memberData.email2] : [])]
  const childName = `${memberData.firstName} ${memberData.lastName}`

  await sendDeactivationConfirmation({
    to: memberEmails,
    clubName: club.name,
    childName,
  })

  if (isSelf) {
    const superusers = await prisma.user.findMany({
      where: { clubId: club.id, role: 'SUPERUSER' },
      include: { emails: true },
    })
    const superuserEmails = superusers.flatMap((su) => su.emails.map((e) => e.email))

    await sendSuperUserNotification({
      to: superuserEmails,
      clubName: club.name,
      childName,
      clubSlug: club.slug,
      userId: memberId,
    })

    deleteCookie(event, 'session_token', { path: '/' })
  }

  return { member: updated }
})
