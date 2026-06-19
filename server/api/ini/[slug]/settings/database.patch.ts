import postgres from 'postgres'
import { z } from 'zod'
import { clientCache } from '~/server/utils/clubDatabase'
import { encrypt } from '~/server/utils/encryption'
import { prisma } from '~/server/utils/prisma'

const schema = z.object({
  dsn: z.string().min(1),
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

  // Verify connection before saving
  let testSql: ReturnType<typeof postgres> | undefined
  try {
    testSql = postgres(parsed.data.dsn, {
      max: 1,
      connect_timeout: 5,
      ssl: { rejectUnauthorized: false },
    })
    await testSql`SELECT 1`
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw createError({
      statusCode: 422,
      statusMessage: `Verbindung fehlgeschlagen: ${detail}`,
    })
  } finally {
    await testSql?.end()
  }

  await prisma.clubDatabase.upsert({
    where: { clubId: club.id },
    create: { clubId: club.id, type: 'POSTGRES', encryptedDsn: encrypt(parsed.data.dsn) },
    update: { type: 'POSTGRES', encryptedDsn: encrypt(parsed.data.dsn), pendingEncryptedDsn: null },
  })
  clientCache.delete(club.id)

  return { ok: true }
})
