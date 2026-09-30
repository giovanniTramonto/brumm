import { getISBJDefaultHost } from '~/server/utils/isbjClient'
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const record = await prisma.clubISBJConfig.findUnique({ where: { clubId: club.id } })

  const defaultHost = getISBJDefaultHost()

  if (!record) return { hasConfig: false, defaultHost }

  return {
    hasConfig: true,
    defaultHost,
    host: record.host,
    username: record.username,
    providerNumber: record.providerNumber,
    facilityNumber: record.facilityNumber,
  }
})
