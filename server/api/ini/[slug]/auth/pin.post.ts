import { setDeviceIdCookie } from '~/server/utils/deviceSession'
import { getMemberData } from '~/server/utils/memberData'
import { verifyPin } from '~/server/utils/pinHash'
import { prisma } from '~/server/utils/prisma'
import { formatZodError, pinSchema } from '~/server/utils/schemas'

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const MAX_ATTEMPTS = 3

export default defineEventHandler(async (event) => {
  const club = event.context.club

  const deviceId = getCookie(event, 'device_id')
  if (!deviceId) {
    throw createError({ statusCode: 400, statusMessage: 'Kein Gerät registriert' })
  }

  const parsed = pinSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: formatZodError(parsed.error) })
  }

  const { pin, userId } = parsed.data

  const where = userId
    ? { deviceId, userId, clubId: club.id, expiresAt: { gt: new Date() } }
    : { deviceId, clubId: club.id, expiresAt: { gt: new Date() } }

  const deviceSession = await prisma.deviceSession.findFirst({
    where,
    include: { user: { include: { emails: true } } },
  })

  if (!deviceSession) {
    deleteCookie(event, 'device_id', { path: '/' })
    throw createError({ statusCode: 401, statusMessage: 'Gerät nicht erkannt' })
  }

  if (deviceSession.lockedAt) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Zu viele Fehlversuche. Bitte per E-Mail anmelden.',
    })
  }

  const isValid = await verifyPin(pin, deviceSession.pinHash)

  if (!isValid) {
    const newAttempts = deviceSession.failedAttempts + 1
    await prisma.deviceSession.update({
      where: { id: deviceSession.id },
      data: {
        failedAttempts: newAttempts,
        lockedAt: newAttempts >= MAX_ATTEMPTS ? new Date() : null,
      },
    })

    if (newAttempts >= MAX_ATTEMPTS) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Zu viele Fehlversuche. Bitte per E-Mail anmelden.',
      })
    }

    const remaining = MAX_ATTEMPTS - newAttempts
    throw createError({
      statusCode: 401,
      statusMessage: `Falsche PIN. Noch ${remaining} Versuch${remaining === 1 ? '' : 'e'}.`,
    })
  }

  const sessionExpiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS)
  const deviceExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  await prisma.session.deleteMany({ where: { userId: deviceSession.userId } })

  const [session] = await prisma.$transaction([
    prisma.session.create({
      data: { userId: deviceSession.userId, clubId: club.id, expiresAt: sessionExpiresAt },
    }),
    prisma.deviceSession.update({
      where: { id: deviceSession.id },
      data: { failedAttempts: 0, expiresAt: deviceExpiresAt },
    }),
  ])

  setCookie(event, 'session_token', session.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: sessionExpiresAt,
    path: '/',
  })

  // Refresh device_id cookie expiry
  setDeviceIdCookie(event, deviceId, deviceExpiresAt)

  const user = deviceSession.user
  if (user.role === 'MEMBER') {
    const memberData = await getMemberData(user.id, club)
    if (memberData)
      return {
        user: {
          ...user,
          firstName: memberData.guardian1Name ?? memberData.firstName,
          lastName: null,
        },
        club,
      }
  }

  return { user, club }
})
