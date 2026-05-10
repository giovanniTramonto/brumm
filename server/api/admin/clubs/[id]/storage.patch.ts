import { checkAdminAuth } from '~/server/utils/adminAuth'

export default defineEventHandler(async (event) => {
  checkAdminAuth(event)
  throw createError({ statusCode: 410, statusMessage: 'Storage-Setup erfolgt jetzt per OAuth' })
})
