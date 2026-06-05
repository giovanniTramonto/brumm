import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const deviceToken = getCookie(event, 'device_token')

  if (deviceToken) {
    await prisma.deviceSession.deleteMany({ where: { deviceToken } })
  }

  deleteCookie(event, 'device_token', { path: '/' })

  return { message: 'Gerät abgemeldet' }
})
