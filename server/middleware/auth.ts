import { prisma } from "~/server/utils/prisma"

const PUBLIC_ROUTES = [
  /^\/api\/register$/,
  /^\/api\/ini\/[^/]+\/auth\/magic-link$/,
  /^\/api\/ini\/[^/]+\/auth\/verify\//,
]

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  const isPublic = PUBLIC_ROUTES.some((pattern) => pattern.test(path))
  if (isPublic) return

  if (!path.startsWith("/api/")) return

  const token = getCookie(event, "session_token")
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "Nicht angemeldet" })
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          emails: true,
          group: true,
        },
      },
    },
  })

  if (!session || session.expiresAt < new Date()) {
    deleteCookie(event, "session_token")
    throw createError({ statusCode: 401, statusMessage: "Sitzung abgelaufen" })
  }

  event.context.user = session.user
  event.context.session = session
})
