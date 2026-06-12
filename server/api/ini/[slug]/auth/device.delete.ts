import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const deviceId = getCookie(event, 'device_id')

  if (deviceId) {
    await prisma.deviceSession.deleteMany({ where: { deviceId } })
    deleteCookie(event, 'device_id', { path: '/' })
  }

  // Clean up legacy cookie if still present
  const deviceToken = getCookie(event, 'device_token')
  if (deviceToken) {
    await prisma.deviceSession.deleteMany({ where: { deviceToken } })
    deleteCookie(event, 'device_token', { path: '/' })
  }

  return { message: 'Gerät abgemeldet' }
})
