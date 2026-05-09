import { prisma } from "~/server/utils/prisma"

export default defineEventHandler(async (event) => {
  const club = event.context.club
  const currentUser = event.context.user
  const memberId = getRouterParam(event, "id")

  if (!memberId) {
    throw createError({ statusCode: 400, statusMessage: "ID fehlt" })
  }

  const canViewAll = currentUser.role === "SUPERUSER" || currentUser.role === "TEAM"
  if (!canViewAll && currentUser.id !== memberId) {
    throw createError({ statusCode: 403, statusMessage: "Keine Berechtigung" })
  }

  const member = await prisma.user.findFirst({
    where: { id: memberId, clubId: club.id },
    include: { group: true, emails: true },
  })

  if (!member) {
    throw createError({ statusCode: 404, statusMessage: "Mitglied nicht gefunden" })
  }

  return { member }
})
