import { prisma } from "~/server/utils/prisma"

export default defineEventHandler(async (event) => {
  const secret = getHeader(event, "x-admin-secret")
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    throw createError({ statusCode: 401, statusMessage: "Nicht autorisiert" })
  }

  const clubId = getRouterParam(event, "id")
  if (!clubId) throw createError({ statusCode: 400, statusMessage: "ID fehlt" })

  const club = await prisma.club.findUnique({ where: { id: clubId } })
  if (!club) throw createError({ statusCode: 404, statusMessage: "Verein nicht gefunden" })

  const userIds = (
    await prisma.user.findMany({ where: { clubId }, select: { id: true } })
  ).map((u) => u.id)

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { clubId } }),
    prisma.magicLink.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.invite.deleteMany({ where: { clubId } }),
    prisma.userEmail.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { clubId } }),
    prisma.group.deleteMany({ where: { clubId } }),
    prisma.club.delete({ where: { id: clubId } }),
  ])

  return { ok: true }
})
