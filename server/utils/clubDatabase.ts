import postgres, { type Sql } from 'postgres'
import { decrypt } from './encryption'
import { runMigrations } from './migrations/runner'
import { prisma } from './prisma'

// Per-process client cache keyed by clubId — exported so endpoints can invalidate on DSN change
export const clientCache = new Map<string, Sql>()

export async function getClubDb(clubId: string): Promise<Sql> {
  const cached = clientCache.get(clubId)
  if (cached) return cached

  const record = await prisma.club.findUnique({
    where: { id: clubId },
    select: { encryptedDsn: true },
  })
  if (!record?.encryptedDsn) {
    throw createError({ statusCode: 503, statusMessage: 'Keine Postgres-Datenbank konfiguriert.' })
  }

  const dsn = decrypt(record.encryptedDsn)
  const sql = postgres(dsn, { max: 5, idle_timeout: 30 })

  clientCache.set(clubId, sql)
  return sql
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
