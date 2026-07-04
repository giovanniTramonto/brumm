import postgres from 'postgres'
import { z } from 'zod'
import { invalidateClubDb, migrateClubDb } from '~/server/utils/clubDatabase'
import { encrypt } from '~/server/utils/encryption'
import { prisma } from '~/server/utils/prisma'

const schema = z
  .object({
    dsn: z.string().min(1).optional(),
    poolDsn: z.string().min(1).optional(),
  })
  .refine((d) => d.dsn || d.poolDsn, { message: 'DSN oder Pool-DSN erforderlich' })

async function testConnection(dsn: string, prepare: boolean): Promise<void> {
  let sql: ReturnType<typeof postgres> | undefined
  try {
    const dsnUrl = new URL(dsn.replace(/^postgres:\/\//, 'postgresql://'))
    const sslMode = dsnUrl.searchParams.get('sslmode')
    const ssl = sslMode === 'disable' ? false : { rejectUnauthorized: false }
    sql = postgres(dsn, { max: 1, connect_timeout: 5, ssl, prepare })
    await sql`SELECT 1`
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw createError({ statusCode: 422, statusMessage: `Verbindung fehlgeschlagen: ${detail}` })
  } finally {
    await sql?.end()
  }
}

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

  const { dsn, poolDsn } = parsed.data

  if (dsn) await testConnection(dsn, true)
  if (poolDsn) await testConnection(poolDsn, false)

  await prisma.club.update({
    where: { id: club.id },
    data: {
      ...(dsn ? { encryptedDsn: encrypt(dsn) } : {}),
      ...(poolDsn ? { encryptedPoolDsn: encrypt(poolDsn) } : {}),
    },
  })

  await invalidateClubDb(club.id)

  if (dsn) await migrateClubDb(club.id)

  return { ok: true }
})
