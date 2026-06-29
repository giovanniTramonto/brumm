import { z } from 'zod'
import { sendPinDeleteLink } from '~/server/utils/email'
import { createMagicLink } from '~/server/utils/magicLink'
import { getManagerData } from '~/server/utils/managerData'
import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'
import { getTeamMemberData } from '~/server/utils/teamData'

const schema = z.object({
  userId: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const deviceId = getCookie(event, 'device_id')

  if (!deviceId) {
    return { message: 'Falls ein Gerät registriert ist, wurde ein Link gesendet' }
  }

  const parsed = schema.safeParse(await readBody(event))
  const targetUserId = parsed.success ? parsed.data.userId : undefined

  const where = targetUserId
    ? { deviceId, userId: targetUserId, clubId: club.id, expiresAt: { gt: new Date() } }
    : { deviceId, clubId: club.id, expiresAt: { gt: new Date() } }

  const deviceSession = await prisma.deviceSession.findFirst({
    where,
    include: { user: true },
  })

  if (!deviceSession) {
    return { message: 'Falls ein Gerät registriert ist, wurde ein Link gesendet' }
  }

  const user = deviceSession.user
  let email: string | null = null

  if (user.role === 'SUPERUSER') {
    email = club.adminEmail ?? null
  } else if (user.role === 'MEMBER') {
    const memberData = await getMemberData(user.id, club)
    email = memberData?.email1 ?? null
  } else if (user.role === 'MANAGER' && user.storageId) {
    const manager = await prisma.manager.findFirst({
      where: { storageId: user.storageId, clubId: club.id },
    })
    if (manager) {
      const managerData = await getManagerData(manager.id, club)
      email = managerData?.email ?? null
    }
  } else if (user.role === 'TEAM' && user.storageId) {
    const team = await prisma.team.findFirst({
      where: { storageId: user.storageId, clubId: club.id },
    })
    if (team) {
      const teamData = await getTeamMemberData(team.id, club)
      email = teamData?.email ?? null
    }
  }

  if (!email) {
    return { message: 'Falls ein Gerät registriert ist, wurde ein Link gesendet' }
  }

  const magicLink = await createMagicLink({
    userId: user.id,
    pendingDeviceTokenToDelete: deviceSession.deviceToken,
  })

  await sendPinDeleteLink({
    to: email,
    clubName: club.name,
    clubSlug: club.slug,
    token: magicLink.token,
  })

  return { message: 'Falls ein Gerät registriert ist, wurde ein Link gesendet' }
})
