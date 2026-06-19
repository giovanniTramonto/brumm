import postgres from 'postgres'
import { z } from 'zod'
import { clientCache } from '~/server/utils/clubDatabase'
import { encrypt } from '~/server/utils/encryption'
import { prisma } from '~/server/utils/prisma'

const schema = z.object({
  dsn: z.string().min(1),
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

  const existing = await prisma.clubDatabase.findUnique({ where: { clubId: club.id } })
  const isAlreadyOnPostgres = existing?.type === 'POSTGRES' && !!existing.encryptedDsn

  if (isAlreadyOnPostgres && !parsed.data.activateDirectly) {
    // Save as pending — active DSN stays unchanged until transfer completes
    await prisma.clubDatabase.update({
      where: { clubId: club.id },
      data: { pendingEncryptedDsn: encrypt(parsed.data.dsn) },
    })
  } else if (isAlreadyOnPostgres && parsed.data.activateDirectly) {
    // Direct activation — e.g. after restoring a backup, no transfer needed
    await prisma.clubDatabase.update({
      where: { clubId: club.id },
      data: { encryptedDsn: encrypt(parsed.data.dsn), pendingEncryptedDsn: null },
    })
    clientCache.delete(club.id)
  } else {
    // First-time setup: save as pending — data transfer activates it
    await prisma.clubDatabase.upsert({
      where: { clubId: club.id },
      create: {
        clubId: club.id,
        type: 'GOOGLE_SHEETS',
        pendingEncryptedDsn: encrypt(parsed.data.dsn),
      },
      update: { pendingEncryptedDsn: encrypt(parsed.data.dsn) },
    })
  }

  return { ok: true, isPending: isAlreadyOnPostgres ? !parsed.data.activateDirectly : true }
})
