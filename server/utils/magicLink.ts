import { prisma } from '~/server/utils/prisma'

type CreateMagicLinkOptions = {
  userId: string
  expiresInMs?: number
  pendingPinHash?: string
  pendingDeviceTokenToDelete?: string
  withOtp?: boolean
}

const FIFTEEN_MINUTES = 15 * 60 * 1000
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

function generateOtp(): string {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')
}

export async function createMagicLink({
  userId,
  expiresInMs = FIFTEEN_MINUTES,
  pendingPinHash,
  pendingDeviceTokenToDelete,
  withOtp = false,
}: CreateMagicLinkOptions) {
  const otpCode = withOtp ? generateOtp() : undefined
  return prisma.magicLink.create({
    data: {
      userId,
      otpCode,
      expiresAt: new Date(Date.now() + expiresInMs),
      pendingPinHash,
      pendingDeviceTokenToDelete,
    },
  })
}

export { FIFTEEN_MINUTES, SEVEN_DAYS }
