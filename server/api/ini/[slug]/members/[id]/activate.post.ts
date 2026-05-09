import { prisma } from "~/server/utils/prisma"

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, "id")

  if (currentUser.role !== "SUPERUSER") {
    throw createError({ statusCode: 403, statusMessage: "Keine Berechtigung" })
  }

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: "ID fehlt" })
  }

  const member = await prisma.user.findFirst({
    where: { id: memberId, clubId: club.id },
  })

  if (!member) {
    throw createError({ statusCode: 404, statusMessage: "Mitglied nicht gefunden" })
  }

  if (member.isActive) {
    throw createError({ statusCode: 409, statusMessage: "Mitglied bereits aktiv" })
  }

  const updated = await prisma.user.update({
    where: { id: memberId },
    data: { isActive: true },
  })

  return { member: updated }
})
