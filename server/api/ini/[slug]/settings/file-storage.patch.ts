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

  await prisma.club.update({
    where: { id: club.id },
    data: { encryptedS3Config: encrypt(JSON.stringify(parsed.data)) },
  })

  invalidateS3Cache(club.id)
  return { ok: true }
})
