import { prisma } from '~/server/utils/prisma'
import { invalidateS3Cache } from '~/server/utils/s3Client'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  await prisma.clubFileStorage.upsert({
    where: { clubId: club.id },
    create: { clubId: club.id, type: 'S3' },
    update: { type: 'S3', encryptedConfig: null, pendingEncryptedConfig: null },
  })

  invalidateS3Cache(club.id)
  return { ok: true }
})
