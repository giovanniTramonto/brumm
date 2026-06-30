import postgres from 'postgres'
import { z } from 'zod'
import { invalidateClubDb, migrateClubDb } from '~/server/utils/clubDatabase'
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
    const dsnUrl = new URL(parsed.data.dsn.replace(/^postgres:\/\//, 'postgresql://'))
    const sslMode = dsnUrl.searchParams.get('sslmode')
    const ssl = sslMode === 'disable' ? false : { rejectUnauthorized: false }
    testSql = postgres(parsed.data.dsn, {
      max: 1,
      connect_timeout: 5,
      ssl,
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

  await prisma.club.update({
    where: { id: club.id },
    data: { encryptedDsn: encrypt(parsed.data.dsn) },
  })
  await invalidateClubDb(club.id)
  await migrateClubDb(club.id)

  return { ok: true }
})
