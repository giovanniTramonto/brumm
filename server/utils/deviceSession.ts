import { createId } from '@paralleldrive/cuid2'
import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'

const DEVICE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

export async function maybeCreateDeviceSession(
  event: H3Event,
  userId: string,
  clubId: string,
  pendingPinHash: string | null,
) {
  if (!pendingPinHash) return

  const deviceToken = createId()
  const expiresAt = new Date(Date.now() + DEVICE_MAX_AGE_MS)

  await prisma.deviceSession.deleteMany({
    where: { userId, clubId, expiresAt: { lt: new Date() } },
  })

  await prisma.deviceSession.create({
    data: { userId, clubId, deviceToken, pinHash: pendingPinHash, expiresAt },
  })

  setCookie(event, 'device_token', deviceToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}
