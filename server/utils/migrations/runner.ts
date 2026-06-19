import type { Sql } from 'postgres'

const MIGRATIONS: { filename: string; sql: string }[] = [
  {
    filename: '001_initial.sql',
    sql: `
CREATE TABLE IF NOT EXISTS members (
  user_id        TEXT PRIMARY KEY,
  storage_ref    TEXT,
  first_name     TEXT,
  last_name      TEXT,
  birth_date     TEXT,
  guardian1_name TEXT,
  guardian2_name TEXT,
  email1         TEXT,
  email2         TEXT,
  group_id       TEXT,
  contract_end   TEXT,
  phone1         TEXT,
  phone2         TEXT,
  surcharges     TEXT,
  care_type      TEXT,
  last_edited_at TEXT,
  last_edited_by TEXT,
  address        TEXT
);
CREATE TABLE IF NOT EXISTS managers (
  manager_id TEXT PRIMARY KEY,
  storage_id TEXT UNIQUE,
  name       TEXT,
  email      TEXT
);
CREATE TABLE IF NOT EXISTS groups (
  group_id TEXT PRIMARY KEY,
  name     TEXT,
  email    TEXT
);
CREATE TABLE IF NOT EXISTS team_members (
  team_id    TEXT PRIMARY KEY,
  storage_id TEXT UNIQUE,
  name       TEXT,
  email      TEXT
);`,
  },
]

export async function runMigrations(sql: Sql): Promise<{ applied: string[]; failed?: string }> {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL  PRIMARY KEY,
      filename    TEXT    UNIQUE NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  const applied = await sql<{ filename: string }[]>`
    SELECT filename FROM _migrations ORDER BY id
  `
  const appliedSet = new Set(applied.map((r) => r.filename))

  const newlyApplied: string[] = []

  for (const migration of MIGRATIONS) {
    if (appliedSet.has(migration.filename)) continue
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(migration.sql)
        await tx`INSERT INTO _migrations (filename) VALUES (${migration.filename})`
      })
      newlyApplied.push(migration.filename)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { applied: newlyApplied, failed: `${migration.filename}: ${message}` }
    }
  }

  return { applied: newlyApplied }
}
