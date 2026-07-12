import { getClubDb } from '~/server/utils/clubDatabase'
import {
  getAnnualFinancialsSummary,
  getMonthlyFinancials,
} from '~/server/utils/storage/postgres/financials'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || (user.role !== 'SUPERUSER' && user.role !== 'MANAGER')) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const query = getQuery(event)
  const year = Number(query.year)
  const month = query.month !== undefined ? Number(query.month) : undefined

  if (!Number.isFinite(year) || year < 2000) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültiges Jahr' })
  }

  const sql = await getClubDb(club.id)

  if (month !== undefined) {
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      throw createError({ statusCode: 400, statusMessage: 'Ungültiger Monat' })
    }
    return getMonthlyFinancials(sql, month, year)
  }

  return getAnnualFinancialsSummary(sql, year)
})
