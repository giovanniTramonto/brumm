import type { H3Event } from 'h3'

export function checkAdminAuth(event: H3Event): void {
  const cookie = getCookie(event, 'admin_session')
  if (!cookie || cookie !== process.env.ADMIN_SECRET) {
    throw createError({ statusCode: 401, statusMessage: 'Nicht autorisiert' })
  }
}
