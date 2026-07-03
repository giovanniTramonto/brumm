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
  {
    filename: '002_parent_jobs.sql',
    sql: `
CREATE TABLE IF NOT EXISTS parent_jobs (
  job_id     TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_order INT  NOT NULL DEFAULT 0,
  tasks      TEXT
);
CREATE TABLE IF NOT EXISTS parent_job_members (
  member_id TEXT    PRIMARY KEY,
  job_id    TEXT    NOT NULL REFERENCES parent_jobs(job_id) ON DELETE CASCADE,
  email     TEXT    NOT NULL,
  name      TEXT,
  phone     TEXT,
  tasks     TEXT,
  is_leader BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (job_id, email)
);`,
  },
  {
    filename: '003_parent_jobs_sort_order.sql',
    sql: `ALTER TABLE parent_jobs ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
ALTER TABLE parent_job_members ADD COLUMN IF NOT EXISTS tasks TEXT;`,
  },
  {
    filename: '004_parent_job_members_sort_order.sql',
    sql: `ALTER TABLE parent_job_members ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
UPDATE parent_job_members SET sort_order = sub.rn FROM (
  SELECT member_id, ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY member_id) - 1 AS rn
  FROM parent_job_members
) sub WHERE parent_job_members.member_id = sub.member_id;`,
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
