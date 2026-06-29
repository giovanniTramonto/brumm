import { getClubDb } from '~/server/utils/clubDatabase'
import { prisma } from '~/server/utils/prisma'

const PUBLIC_ROUTES = [
  /^\/api\/health$/,
  /^\/api\/clubs$/,
  /^\/api\/register$/,
  /^\/api\/admin\//,
  /^\/api\/login\/lookup$/,
  /^\/api\/ini\/[^/]+\/auth\/magic-link$/,
  /^\/api\/ini\/[^/]+\/auth\/verify\//,
  /^\/api\/ini\/[^/]+\/auth\/device$/,
  /^\/api\/ini\/[^/]+\/auth\/pin$/,
  /^\/api\/ini\/[^/]+\/auth\/pin-forgot$/,
  /^\/api\/ini\/[^/]+\/auth\/verify-otp$/,
]

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return

  const isPublic = PUBLIC_ROUTES.some((pattern) => pattern.test(path))
  const slug = path.match(/^\/api\/ini\/([^/]+)/)?.[1]
  const token = getCookie(event, 'session_token')

  const [sessionResult, clubResult] = await Promise.all([
    !isPublic && token
      ? prisma.session.findUnique({ where: { token }, include: { user: true } })
      : Promise.resolve(null),
    slug ? prisma.club.findUnique({ where: { slug } }) : Promise.resolve(null),
  ])

  if (!isPublic) {
    if (!token) throw createError({ statusCode: 401, statusMessage: 'Nicht angemeldet' })
    if (!sessionResult || sessionResult.expiresAt < new Date()) {
      deleteCookie(event, 'session_token')
      throw createError({ statusCode: 401, statusMessage: 'Sitzung abgelaufen' })
    }
    event.context.user = sessionResult.user
    event.context.session = sessionResult
  }

  if (slug) {
    if (!clubResult) throw createError({ statusCode: 404, statusMessage: 'Verein nicht gefunden' })
    event.context.club = clubResult
    // Warm up club DB connection early; handlers await the same cached Promise
    if (clubResult.encryptedDsn) {
      getClubDb(clubResult.id, clubResult.encryptedDsn).catch(() => {})
    }
  }
})
