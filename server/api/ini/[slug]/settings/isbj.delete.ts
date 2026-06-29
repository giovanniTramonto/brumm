import { invalidateISBJCache } from '~/server/utils/isbjClient'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  await prisma.clubISBJConfig.deleteMany({ where: { clubId: club.id } })
  invalidateISBJCache(club.id)
  return { ok: true }
})
