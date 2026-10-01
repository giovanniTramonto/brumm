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

  const { contracts, voucherError } = await fetchISBJContracts(club.id)
  return { isConfigured: true, contracts, voucherError }
})
