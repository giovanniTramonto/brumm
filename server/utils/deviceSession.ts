import { createId } from '@paralleldrive/cuid2'
import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'

const DEVICE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

export function setDeviceIdCookie(event: H3Event, deviceId: string, expiresAt: Date) {
  setCookie(event, 'device_id', deviceId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

export async function maybeCreateDeviceSession(
  event: H3Event,
  userId: string,
  clubId: string,
  pendingPinHash: string | null,
  displayName: string,
) {
  if (!pendingPinHash) return

  const existingDeviceId = getCookie(event, 'device_id')
  const deviceId = existingDeviceId || createId()
  const deviceToken = createId()
  const expiresAt = new Date(Date.now() + DEVICE_MAX_AGE_MS)

  // Delete expired sessions for this user+club, then upsert the active one
  await prisma.deviceSession.deleteMany({
    where: { userId, clubId, expiresAt: { lt: new Date() } },
  })

  const existing = await prisma.deviceSession.findFirst({
    where: { userId, clubId, deviceId, expiresAt: { gte: new Date() } },
  })

  if (existing) {
    await prisma.deviceSession.update({
      where: { id: existing.id },
      data: {
        deviceToken,
        pinHash: pendingPinHash,
        displayName,
        failedAttempts: 0,
        lockedAt: null,
        expiresAt,
      },
    })
  } else {
    await prisma.deviceSession.create({
      data: {
        userId,
        clubId,
        deviceId,
        deviceToken,
        pinHash: pendingPinHash,
        displayName,
        expiresAt,
      },
    })
  }

  setDeviceIdCookie(event, deviceId, expiresAt)
  // Clean up legacy cookie
  deleteCookie(event, 'device_token', { path: '/' })
}
