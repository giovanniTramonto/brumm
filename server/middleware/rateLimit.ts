const RATE_LIMITED_PATHS = ['/api/clubs', '/api/register']
const MAGIC_LINK_PATTERN = /^\/api\/ini\/[^/]+\/auth\/magic-link$/
const PIN_PATTERN = /^\/api\/ini\/[^/]+\/auth\/pin$/

const WINDOW_MS = 60_000
const MAX_REQUESTS = 5
const PIN_MAX_REQUESTS = 3

const store = new Map<string, { count: number; resetAt: number }>()

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  const isMagicLink = MAGIC_LINK_PATTERN.test(path)
  const isPin = PIN_PATTERN.test(path)

  if (!RATE_LIMITED_PATHS.includes(path) && !isMagicLink && !isPin) return

  const ip =
    getRequestHeader(event, 'x-forwarded-for')?.split(',')[0].trim() ??
    getRequestHeader(event, 'x-real-ip') ??
    'unknown'

  const key = `${ip}:${path}`
  const now = Date.now()
  const entry = store.get(key)
  const limit = isPin ? PIN_MAX_REQUESTS : MAX_REQUESTS

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }

  entry.count++

  if (entry.count > limit) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Zu viele Anfragen. Bitte warte kurz und versuche es erneut.',
    })
  }
})
