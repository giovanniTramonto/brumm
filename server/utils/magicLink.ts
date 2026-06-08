import { prisma } from '~/server/utils/prisma'

type CreateMagicLinkOptions = {
  userId: string
  expiresInMs?: number
  pendingPinHash?: string
  pendingDeviceTokenToDelete?: string
}

const FIFTEEN_MINUTES = 15 * 60 * 1000
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

export async function createMagicLink({
  userId,
  expiresInMs = FIFTEEN_MINUTES,
  pendingPinHash,
  pendingDeviceTokenToDelete,
}: CreateMagicLinkOptions) {
  return prisma.magicLink.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + expiresInMs),
      pendingPinHash,
      pendingDeviceTokenToDelete,
    },
  })
}

export { FIFTEEN_MINUTES, SEVEN_DAYS }
