import postgres, { type Sql } from 'postgres'
import { decrypt } from './encryption'
import { runMigrations } from './migrations/runner'
import { prisma } from './prisma'

// Caches a Promise<Sql> so concurrent callers share the same initialization
// instead of each establishing their own connection.
const clientCache = new Map<string, Promise<Sql>>()

export async function invalidateClubDb(clubId: string): Promise<void> {
  const cached = clientCache.get(clubId)
  clientCache.delete(clubId)
  if (cached) {
    const sql = await cached.catch(() => null)
    await sql?.end()
  }
}

// Returns pool client (max:5, prepare:false) if pool DSN is configured,
// otherwise direct client (max:1). Used for all runtime API queries.
export async function getClubDb(clubId: string): Promise<Sql> {
  const cached = clientCache.get(clubId)
  if (cached) return cached

  const promise = (async () => {
    const record = await prisma.club.findUnique({
      where: { id: clubId },
      select: { encryptedDsn: true, encryptedPoolDsn: true },
    })

    if (record?.encryptedPoolDsn) {
      const dsn = decrypt(record.encryptedPoolDsn)
      const sql = postgres(dsn, { max: 5, idle_timeout: 10, prepare: false })
      console.time(`pool-warmup:${clubId}`)
      await sql`SELECT 1`
      console.timeEnd(`pool-warmup:${clubId}`)
      return sql
    }

    if (!record?.encryptedDsn) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Keine Postgres-Datenbank konfiguriert.',
      })
    }

    const dsn = decrypt(record.encryptedDsn)
    return postgres(dsn, { max: 1, idle_timeout: 10 })
  })()

  clientCache.set(clubId, promise)
  promise.catch(() => clientCache.delete(clubId))
  return promise
}

// Always uses the direct DSN (not pool) — required for migrations which need
// full session support that PgBouncer transaction mode doesn't provide.
export async function migrateClubDb(
  clubId: string,
): Promise<{ applied: string[]; failed?: string }> {
  const record = await prisma.club.findUnique({
    where: { id: clubId },
    select: { encryptedDsn: true },
  })
  if (!record?.encryptedDsn) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Keine Postgres-Datenbank konfiguriert.',
    })
  }
  const dsn = decrypt(record.encryptedDsn)
  const sql = postgres(dsn, { max: 1, idle_timeout: 10 })
  try {
    return await runMigrations(sql)
  } finally {
    await sql.end()
  }
}

// Called on deploy to migrate all clubs that have Postgres configured
export async function migrateAllClubDbs(): Promise<
  { clubId: string; applied: string[]; failed?: string }[]
> {
  const clubs = await prisma.club.findMany({
    where: { encryptedDsn: { not: null } },
    select: { id: true },
  })

  const results = await Promise.allSettled(
    clubs.map(async (c) => {
      const result = await migrateClubDb(c.id)
      return { clubId: c.id, ...result }
    }),
  )

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return {
      clubId: clubs[i].id,
      applied: [],
      failed: r.reason instanceof Error ? r.reason.message : String(r.reason),
    }
  })
}
