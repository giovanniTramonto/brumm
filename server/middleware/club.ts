import { prisma } from "~/server/utils/prisma"

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug")
  if (!slug) return

  const club = await prisma.club.findUnique({ where: { slug } })
  if (!club) {
    throw createError({ statusCode: 404, statusMessage: "Verein nicht gefunden" })
  }

  event.context.club = club
})
