import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const record = await prisma.clubFileStorage.findUnique({ where: { clubId: club.id } })

  return {
    type: record?.type ?? 'GOOGLE_DRIVE',
    hasConfig: !!record?.encryptedConfig,
    hasPending: !!record?.pendingEncryptedConfig,
  }
})
