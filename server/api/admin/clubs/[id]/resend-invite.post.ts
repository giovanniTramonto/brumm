import { checkAdminAuth } from '~/server/utils/adminAuth'
import { sendWelcomeEmail } from '~/server/utils/email'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  checkAdminAuth(event)

  const clubId = getRouterParam(event, 'id')
  if (!clubId) throw createError({ statusCode: 400, statusMessage: 'ID fehlt' })

  const club = await prisma.club.findUnique({ where: { id: clubId } })
  if (!club) throw createError({ statusCode: 404, statusMessage: 'Verein nicht gefunden' })
  if (!club.adminEmail)
    throw createError({ statusCode: 404, statusMessage: 'Keine E-Mail gefunden' })

  const superuser = await prisma.user.findFirst({ where: { clubId, role: 'SUPERUSER' } })
  if (!superuser) throw createError({ statusCode: 404, statusMessage: 'Kein SUPERUSER gefunden' })

  await prisma.magicLink.updateMany({
    where: { userId: superuser.id, isUsed: false },
    data: { isUsed: true },
  })

  const magicLink = await prisma.magicLink.create({
    data: {
      userId: superuser.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })

  await sendWelcomeEmail({
    to: club.adminEmail,
    clubName: club.name,
    clubSlug: club.slug,
    token: magicLink.token,
  })

  return { ok: true, sentTo: club.adminEmail }
})
