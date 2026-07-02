import { checkAdminAuth } from '~/server/utils/adminAuth'
import { migrateAllClubDbs } from '~/server/utils/clubDatabase'

export default defineEventHandler(async (event) => {
  checkAdminAuth(event)
  const results = await migrateAllClubDbs()
  return { results }
})
