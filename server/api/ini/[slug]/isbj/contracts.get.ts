import { isbjFetch } from '~/server/utils/isbjClient'
import { fetchISBJContracts } from '~/server/utils/isbjContracts'
import { prisma } from '~/server/utils/prisma'
import type { ISBJContractsResponse } from '~/types'

export default defineEventHandler(async (event): Promise<ISBJContractsResponse> => {
  const user = event.context.user
  const club = event.context.club

  if (!user || (user.role !== 'SUPERUSER' && user.role !== 'MANAGER')) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const config = await prisma.clubISBJConfig.findUnique({
    where: { clubId: club.id },
    select: { id: true },
  })
  if (!config) return { isConfigured: false, contracts: [], voucherError: null }

  // TEMPORARY diagnostics: raw first list page (contract numbers + paging only, no child data)
  if (getQuery(event).raw && user.role === 'SUPERUSER') {
    const [active, all] = await Promise.all([
      isbjFetch(club.id, 'GET', '/api/v1/betreuung/vertraege?aktiv=true&max=5&start=0'),
      isbjFetch(club.id, 'GET', '/api/v1/betreuung/vertraege?max=5&start=0'),
    ])
    return { active, all } as unknown as ISBJContractsResponse
  }

  const { contracts, voucherError } = await fetchISBJContracts(club.id)
  return { isConfigured: true, contracts, voucherError }
})
