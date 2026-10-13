import { isbjFetch } from '~/server/utils/isbjClient'
import { prisma } from '~/server/utils/prisma'
import type { ISBJConnectionResponse } from '~/types'

// Lightweight health check for the navigation indicator: same call as the settings "Verbindung
// testen" button, but for every MANAGER and with the failure returned as data instead of an error
export default defineEventHandler(async (event): Promise<ISBJConnectionResponse> => {
  const user = event.context.user
  const club = event.context.club

  if (!user || (user.role !== 'SUPERUSER' && user.role !== 'MANAGER')) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const config = await prisma.clubISBJConfig.findUnique({
    where: { clubId: club.id },
    select: { id: true },
  })
  if (!config) return { isConfigured: false, isConnected: false, error: null }

  try {
    await isbjFetch(club.id, 'GET', '/api/v1/betreuung/vertraege?max=1&start=0')
    return { isConfigured: true, isConnected: true, error: null }
  } catch (err) {
    return {
      isConfigured: true,
      isConnected: false,
      error: (err as { statusMessage?: string })?.statusMessage ?? 'Verbindung fehlgeschlagen',
    }
  }
})
