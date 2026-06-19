import postgres, { type Sql } from 'postgres'
import { decrypt } from './encryption'
import { runMigrations } from './migrations/runner'
import { prisma } from './prisma'

// Per-process client cache keyed by clubId — exported so endpoints can invalidate on DSN change
export const clientCache = new Map<string, Sql>()

export async function getClubDb(clubId: string): Promise<Sql> {
  const cached = clientCache.get(clubId)
  if (cached) return cached

  const record = await prisma.clubDatabase.findUnique({ where: { clubId } })
  if (!record || record.type !== 'POSTGRES' || !record.encryptedDsn) {
    throw createError({ statusCode: 503, statusMessage: 'Keine Postgres-Datenbank konfiguriert.' })
  }

  const dsn = decrypt(record.encryptedDsn)
  const sql = postgres(dsn, { max: 5, idle_timeout: 30, ssl: { rejectUnauthorized: false } })

  clientCache.set(clubId, sql)
  return sql
}

export async function getClubDbType(clubId: string): Promise<'GOOGLE_SHEETS' | 'POSTGRES'> {
  const record = await prisma.clubDatabase.findUnique({ where: { clubId } })
  return record?.type ?? 'GOOGLE_SHEETS'
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
  const records = await prisma.clubDatabase.findMany({
    where: { type: 'POSTGRES', encryptedDsn: { not: null } },
  })

  const results = await Promise.allSettled(
    records.map(async (r) => {
      const result = await migrateClubDb(r.clubId)
      return { clubId: r.clubId, ...result }
    }),
  )

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return {
      clubId: records[i].clubId,
      applied: [],
      failed: r.reason instanceof Error ? r.reason.message : String(r.reason),
    }
  })
}
