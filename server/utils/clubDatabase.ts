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

export async function getClubDb(clubId: string, knownEncryptedDsn?: string): Promise<Sql> {
  const cached = clientCache.get(clubId)
  if (cached) return cached

  const promise = (async () => {
    let encryptedDsn: string | null | undefined
    if (knownEncryptedDsn !== undefined) {
      encryptedDsn = knownEncryptedDsn
    } else {
      const record = await prisma.club.findUnique({
        where: { id: clubId },
        select: { encryptedDsn: true },
      })
      encryptedDsn = record?.encryptedDsn
    }
    if (!encryptedDsn) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Keine Postgres-Datenbank konfiguriert.',
      })
    }
    const dsn = decrypt(encryptedDsn)
    return postgres(dsn, { max: 5, idle_timeout: 30 })
  })()

  clientCache.set(clubId, promise)
  promise.catch(() => clientCache.delete(clubId))
  return promise
}

// Runs pending migrations; used by deploy-succeeded hook and lazy fallback
export async function migrateClubDb(
  clubId: string,
): Promise<{ applied: string[]; failed?: string }> {
  const sql = await getClubDb(clubId)
  return runMigrations(sql)
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
