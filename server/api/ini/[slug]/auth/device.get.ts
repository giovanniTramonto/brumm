import { createId } from '@paralleldrive/cuid2'
import { setDeviceIdCookie } from '~/server/utils/deviceSession'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const now = new Date()

  let deviceId = getCookie(event, 'device_id')

  // Migration: promote legacy device_token to device_id
  if (!deviceId) {
    const deviceToken = getCookie(event, 'device_token')
    if (!deviceToken) return { sessions: [] }

    const legacy = await prisma.deviceSession.findFirst({
      where: { deviceToken, clubId: club.id, expiresAt: { gt: now } },
    })

    if (!legacy) {
      deleteCookie(event, 'device_token', { path: '/' })
      return { sessions: [] }
    }

    deviceId = legacy.deviceId || createId()
    await prisma.deviceSession.update({
      where: { id: legacy.id },
      data: { deviceId },
    })

    setDeviceIdCookie(event, deviceId, legacy.expiresAt)
    deleteCookie(event, 'device_token', { path: '/' })
  }

  const sessions = await prisma.deviceSession.findMany({
    where: { deviceId, clubId: club.id, expiresAt: { gt: now } },
    include: { user: true },
  })

  if (sessions.length === 0) {
    deleteCookie(event, 'device_id', { path: '/' })
    return { sessions: [] }
  }

  return {
    sessions: sessions.map((s) => ({
      userId: s.userId,
      displayName: s.displayName,
      role: s.user.role,
      isLocked: !!s.lockedAt,
    })),
  }
})
