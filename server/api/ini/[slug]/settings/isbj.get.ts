import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const record = await prisma.clubISBJConfig.findUnique({ where: { clubId: club.id } })

  if (!record) return { hasConfig: false }

  return {
    hasConfig: true,
    host: record.host,
    username: record.username,
    traegerNummer: record.traegerNummer,
    einrichtungsNummer: record.einrichtungsNummer,
  }
})
