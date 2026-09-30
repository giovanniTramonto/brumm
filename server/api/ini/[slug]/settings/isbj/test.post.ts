import { isbjFetch } from '~/server/utils/isbjClient'

const LIST_PATH = '/api/v1/betreuung/vertraege'

function statusOf(err: unknown) {
  return (err as { statusCode?: number })?.statusCode
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  // 1. Without query string the signed path is unambiguous → verifies certificate and credentials.
  //    isbjFetch already maps failures to German, user-facing messages.
  await isbjFetch(club.id, 'GET', LIST_PATH)

  // 2. Find out whether ISBJ expects the query string inside the HMAC ("normalized path" is undocumented).
  const pagedPath = `${LIST_PATH}?max=1&start=0`
  const variants = [
    { signQuery: true, label: 'mit Query-String' },
    { signQuery: false, label: 'ohne Query-String' },
  ]
  const results: string[] = []
  for (const variant of variants) {
    try {
      await isbjFetch(club.id, 'GET', pagedPath, undefined, { signQuery: variant.signQuery })
      return {
        ok: true,
        signQuery: variant.signQuery,
        message: `Signatur ${variant.label} funktioniert.`,
      }
    } catch (err) {
      results.push(`${variant.label}: ${statusOf(err) ?? 'Fehler'}`)
    }
  }

  throw createError({
    statusCode: 502,
    statusMessage: `Anmeldung klappt, aber Anfragen mit Query-String werden abgelehnt (${results.join(', ')}).`,
  })
})
