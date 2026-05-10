import { sendInviteEmail } from '~/server/utils/email'
import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, 'id')

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })
  }

  if (currentUser.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const user = await prisma.user.findFirst({
    where: { id: memberId, clubId: club.id },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Mitglied nicht gefunden' })
  }

  if (user.isActive) {
    throw createError({ statusCode: 409, statusMessage: 'Mitglied ist bereits aktiv' })
  }

  const md = await getMemberData(memberId, club)
  if (!md) {
    throw createError({ statusCode: 404, statusMessage: 'Mitgliedsdaten nicht gefunden' })
  }

  if (md.deactivatedAt) {
    throw createError({ statusCode: 409, statusMessage: 'Einladung wurde bereits storniert' })
  }

  await prisma.invite.deleteMany({
    where: { userId: memberId, isUsed: false },
  })

  const invite = await prisma.invite.create({
    data: {
      clubId: club.id,
      userId: memberId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  const childName = `${md.firstName} ${md.lastName}`

  await sendInviteEmail({
    to: md.email1,
    clubName: club.name,
    clubSlug: club.slug,
    token: invite.token,
    childName,
  })

  if (md.email2) {
    await sendInviteEmail({
      to: md.email2,
      clubName: club.name,
      clubSlug: club.slug,
      token: invite.token,
      childName,
    })
  }

  return { ok: true }
})
