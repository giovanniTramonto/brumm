import { prisma } from "~/server/utils/prisma"

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  const slug = path.match(/^\/api\/ini\/([^/]+)/)?.[1]
  if (!slug) return

  const club = await prisma.club.findUnique({ where: { slug } })
  if (!club) {
    throw createError({ statusCode: 404, statusMessage: "Verein nicht gefunden" })
  }

  event.context.club = club
})
