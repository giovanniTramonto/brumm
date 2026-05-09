import { prisma } from "~/server/utils/prisma"

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const token = getRouterParam(event, "token")

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: "Token fehlt" })
  }

  const magicLink = await prisma.magicLink.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!magicLink || magicLink.isUsed || magicLink.expiresAt < new Date()) {
    throw createError({ statusCode: 400, statusMessage: "Link ungültig oder abgelaufen" })
  }

  if (magicLink.user.clubId !== club.id) {
    throw createError({ statusCode: 403, statusMessage: "Zugriff verweigert" })
  }

  const existingSession = await prisma.session.findFirst({
    where: {
      userId: magicLink.userId,
      expiresAt: { gt: new Date() },
    },
  })

  if (existingSession) {
    throw createError({ statusCode: 409, statusMessage: "Zu viele Anmeldungen" })
  }

  await prisma.magicLink.update({
    where: { id: magicLink.id },
    data: { isUsed: true },
  })

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const session = await prisma.session.create({
    data: {
      userId: magicLink.userId,
      clubId: club.id,
      expiresAt,
    },
  })

  setCookie(event, "session_token", session.token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  })

  const user = await prisma.user.findUnique({
    where: { id: magicLink.userId },
    include: { emails: true, group: true },
  })

  return { user, club }
})
