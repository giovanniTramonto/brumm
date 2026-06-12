import { z } from 'zod'
import { maybeCreateDeviceSession } from '~/server/utils/deviceSession'
import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'

const schema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
})

const ROLE_LABELS: Record<string, string> = {
  MEMBER: 'Elternteil',
  MANAGER: 'Vorstand',
  TEAM: 'Team',
  SUPERUSER: 'Admin',
}

export default defineEventHandler(async (event) => {
  const club = event.context.club

  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültiger Code' })
  }

  const magicLink = await prisma.magicLink.findFirst({
    where: {
      otpCode: parsed.data.code,
      isUsed: false,
      expiresAt: { gt: new Date() },
      user: { clubId: club.id },
    },
    include: { user: true },
  })

  if (!magicLink) {
    throw createError({ statusCode: 400, statusMessage: 'Code ungültig oder abgelaufen' })
  }

  await prisma.session.deleteMany({ where: { userId: magicLink.userId } })
  await prisma.magicLink.update({ where: { id: magicLink.id }, data: { isUsed: true } })

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const session = await prisma.session.create({
    data: { userId: magicLink.userId, clubId: club.id, expiresAt },
  })
  setCookie(event, 'session_token', session.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })

  if (magicLink.pendingDeviceTokenToDelete) {
    await prisma.deviceSession.deleteMany({
      where: { deviceToken: magicLink.pendingDeviceTokenToDelete },
    })
    deleteCookie(event, 'device_id', { path: '/' })
    deleteCookie(event, 'device_token', { path: '/' })
  }

  let displayName = ROLE_LABELS[magicLink.user.role] ?? ''
  if (magicLink.pendingPinHash && magicLink.user.role === 'MEMBER') {
    const data = await getMemberData(magicLink.userId, club)
    if (data?.guardian1Name) displayName = data.guardian1Name
  }

  await maybeCreateDeviceSession(
    event,
    magicLink.userId,
    club.id,
    magicLink.pendingPinHash ?? null,
    displayName,
  )

  const user = await prisma.user.findUnique({
    where: { id: magicLink.userId },
    include: { emails: true },
  })
  if (user?.role === 'MEMBER') {
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
