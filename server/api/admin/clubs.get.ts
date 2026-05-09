import { prisma } from "~/server/utils/prisma"

export default defineEventHandler(async (event) => {
  const secret = getHeader(event, "x-admin-secret")
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    throw createError({ statusCode: 401, statusMessage: "Nicht autorisiert" })
  }

  const clubs = await prisma.club.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true } },
    },
  })

  return { clubs }
})
