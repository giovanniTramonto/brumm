import { maybeCreateDeviceSession } from '~/server/utils/deviceSession'
import { getMemberData } from '~/server/utils/memberData'
import { assertValidTransition } from '~/server/utils/memberStatus'
import { prisma } from '~/server/utils/prisma'

const ROLE_LABELS: Record<string, string> = {
  MEMBER: 'Elternteil',
  MANAGER: 'Vorstand',
  TEAM: 'Team',
  SUPERUSER: 'Admin',
}

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Token fehlt' })
  }

  const magicLink = await prisma.magicLink.findUnique({
    where: { token },
    include: { user: true },
  })

  if (magicLink) {
    if (magicLink.isUsed || magicLink.expiresAt < new Date()) {
      throw createError({ statusCode: 400, statusMessage: 'Link ungültig oder abgelaufen' })
    }
    if (magicLink.user.clubId !== club.id) {
      throw createError({ statusCode: 403, statusMessage: 'Zugriff verweigert' })
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
  }

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!invite || invite.isUsed || invite.expiresAt < new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'Link ungültig oder abgelaufen' })
  }
  if (invite.user.clubId !== club.id) {
    throw createError({ statusCode: 403, statusMessage: 'Zugriff verweigert' })
  }

  assertValidTransition(invite.user.status, 'REGISTERED')

  await prisma.session.deleteMany({ where: { userId: invite.userId } })
  await Promise.all([
    prisma.invite.update({ where: { id: invite.id }, data: { isUsed: true } }),
    prisma.user.update({ where: { id: invite.userId }, data: { status: 'REGISTERED' } }),
  ])

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const session = await prisma.session.create({
    data: { userId: invite.userId, clubId: club.id, expiresAt },
  })
  setCookie(event, 'session_token', session.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })

  const user = await prisma.user.findUnique({
    where: { id: invite.userId },
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
