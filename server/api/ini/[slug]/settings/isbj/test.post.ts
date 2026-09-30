import { isbjFetch } from '~/server/utils/isbjClient'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  // isbjFetch already maps failures to German, user-facing messages
  await isbjFetch(club.id, 'GET', '/api/v1/betreuung/vertraege?max=1&start=0')
  return { ok: true }
})
