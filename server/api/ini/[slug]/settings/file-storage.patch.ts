import { z } from 'zod'
import { encrypt } from '~/server/utils/encryption'
import { prisma } from '~/server/utils/prisma'
import { invalidateS3Cache } from '~/server/utils/s3Client'

const schema = z.object({
  endpoint: z.string().url().optional(),
  bucket: z.string().min(1),
  region: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  activateDirectly: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const club = event.context.club

  if (!user || user.role !== 'SUPERUSER') {
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung' })
  }

  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültige Eingabe' })
  }

  const existing = await prisma.clubFileStorage.findUnique({ where: { clubId: club.id } })
  const { activateDirectly, ...s3Config } = parsed.data

  const needsTransfer =
    club.isSetupDone && (!existing || existing.type === 'GOOGLE_DRIVE') && !activateDirectly

  if (needsTransfer) {
    await prisma.clubFileStorage.upsert({
      where: { clubId: club.id },
      create: {
        clubId: club.id,
        type: 'GOOGLE_DRIVE',
        pendingEncryptedConfig: encrypt(JSON.stringify(s3Config)),
      },
      update: { pendingEncryptedConfig: encrypt(JSON.stringify(s3Config)) },
    })
    return { ok: true, isPending: true }
  }

  // Already on S3, no Drive setup, or activateDirectly: activate immediately
  await prisma.clubFileStorage.upsert({
    where: { clubId: club.id },
    create: {
      clubId: club.id,
      type: 'S3',
      encryptedConfig: encrypt(JSON.stringify(s3Config)),
    },
    update: {
      type: 'S3',
      encryptedConfig: encrypt(JSON.stringify(s3Config)),
      pendingEncryptedConfig: null,
    },
  })

  invalidateS3Cache(club.id)
  return { ok: true, isPending: false }
})
