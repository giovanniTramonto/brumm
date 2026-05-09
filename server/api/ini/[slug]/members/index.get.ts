import { prisma } from "~/server/utils/prisma"

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const user = event.context.user

  if (user.role === "MEMBER") {
    throw createError({ statusCode: 403, statusMessage: "Keine Berechtigung" })
  }

  const members = await prisma.user.findMany({
    where: { clubId: club.id },
    include: {
      group: true,
      emails: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })

  return { members }
})
