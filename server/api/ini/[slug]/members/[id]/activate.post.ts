import { sendActivationEmail } from '~/server/utils/email'
import { createMagicLink, SEVEN_DAYS } from '~/server/utils/magicLink'
import { getMemberData } from '~/server/utils/memberData'
import { assertValidTransition } from '~/server/utils/memberStatus'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')

  const canManageMembers =
    currentUser.role === 'SUPERUSER' ||
    (currentUser.role === 'MANAGER' && currentUser.isMemberManager)
  if (!canManageMembers) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  const user = await prisma.user.findFirst({
    where: { id: memberId, clubId: club.id },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  assertValidTransition(user.status, 'ACTIVE')

  const updated = await prisma.user.update({
    where: { id: memberId },
    data: { status: 'ACTIVE' },
  })

  const md = await getMemberData(memberId, club)
  if (md) {
    const emails = [md.email1, ...(md.email2 ? [md.email2] : [])]
    const slug = getRouterParam(event, 'slug')
    const magicLink = await createMagicLink({ userId: memberId, expiresInMs: SEVEN_DAYS })
    const loginUrl = `${process.env.APP_URL}/ini/${slug}/auth/verify/${magicLink.token}`
    await sendActivationEmail({
      to: emails,
      clubName: club.name,
      childName: `${md.firstName} ${md.lastName}`,
      loginUrl,
    })
  }

  return { member: updated }
})
