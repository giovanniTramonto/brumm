import { getClubDb } from '~/server/utils/clubDatabase'
import { deleteExpense } from '~/server/utils/storage/postgres/financials'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club
  const id = getRouterParam(event, 'id') ?? ''

  if (!user || (user.role !== 'SUPERUSER' && user.role !== 'MANAGER')) {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const sql = await getClubDb(club.id)
  await deleteExpense(sql, id)

  return { ok: true }
})
