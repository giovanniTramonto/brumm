import { sendPinDeleteLink } from '~/server/utils/email'
import { getMemberData } from '~/server/utils/memberData'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const deviceToken = getCookie(event, 'device_token')

  if (!deviceToken) {
    return { message: 'Falls ein Gerät registriert ist, wurde ein Link gesendet' }
  }

  const deviceSession = await prisma.deviceSession.findFirst({
    where: { deviceToken, clubId: club.id, expiresAt: { gt: new Date() } },
    include: { user: { include: { emails: true } } },
  })

  if (!deviceSession) {
    return { message: 'Falls ein Gerät registriert ist, wurde ein Link gesendet' }
  }

  const user = deviceSession.user
  let email: string | null = null

  if (user.emails.length > 0) {
    email = user.emails.find((e) => e.isPrimary)?.email ?? user.emails[0].email
  } else if (user.role === 'MEMBER') {
    const memberData = await getMemberData(user.id, club)
    email = memberData?.email1 ?? null
  }

  if (!email) {
    return { message: 'Falls ein Gerät registriert ist, wurde ein Link gesendet' }
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
  const magicLink = await prisma.magicLink.create({
    data: { userId: user.id, expiresAt, pendingDeviceTokenToDelete: deviceToken },
  })

  await sendPinDeleteLink({
    to: email,
    clubName: club.name,
    clubSlug: club.slug,
    token: magicLink.token,
  })

  return { message: 'Falls ein Gerät registriert ist, wurde ein Link gesendet' }
})
