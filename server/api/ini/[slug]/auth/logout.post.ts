import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const session = event.context.session

  if (session) {
    await prisma.session.delete({ where: { id: session.id } })
  }

  deleteCookie(event, 'session_token', { path: '/' })

  return { message: 'Erfolgreich abgemeldet' }
})
