import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const deviceToken = getCookie(event, 'device_token')

  if (!deviceToken) return { hasDevice: false, isLocked: false }

  const deviceSession = await prisma.deviceSession.findFirst({
    where: { deviceToken, clubId: club.id, expiresAt: { gt: new Date() } },
  })

  if (!deviceSession) {
    deleteCookie(event, 'device_token', { path: '/' })
    return { hasDevice: false, isLocked: false }
  }

  return { hasDevice: true, isLocked: !!deviceSession.lockedAt }
})
