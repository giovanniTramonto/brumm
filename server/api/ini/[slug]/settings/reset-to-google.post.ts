import { clientCache } from '~/server/utils/clubDatabase'
import { prisma } from '~/server/utils/prisma'
import { invalidateS3Cache } from '~/server/utils/s3Client'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  await Promise.all([
    prisma.clubDatabase.upsert({
      where: { clubId: club.id },
      create: { clubId: club.id, type: 'GOOGLE_SHEETS' },
      update: { type: 'GOOGLE_SHEETS', encryptedDsn: null, pendingEncryptedDsn: null },
    }),
    prisma.clubFileStorage.upsert({
      where: { clubId: club.id },
      create: { clubId: club.id, type: 'GOOGLE_DRIVE' },
      update: { type: 'GOOGLE_DRIVE', encryptedConfig: null, pendingEncryptedConfig: null },
    }),
    prisma.documentTemplate.updateMany({ where: { clubId: club.id }, data: { s3Key: null } }),
    prisma.memberDocument.updateMany({
      where: { member: { clubId: club.id } },
      data: { s3Key: null },
    }),
    prisma.document.updateMany({ where: { clubId: club.id }, data: { s3Key: null } }),
  ])

  clientCache.delete(club.id)
  invalidateS3Cache(club.id)
  return { ok: true }
})
