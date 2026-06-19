import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Sql } from 'postgres'

const MIGRATIONS_DIR = join(process.cwd(), 'server/utils/migrations/sql')

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

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()

  const newlyApplied: string[] = []

  for (const filename of files) {
    if (appliedSet.has(filename)) continue
    try {
      const content = await readFile(join(MIGRATIONS_DIR, filename), 'utf8')
      await sql.begin(async (tx) => {
        await tx.unsafe(content)
        await tx`INSERT INTO _migrations (filename) VALUES (${filename})`
      })
      newlyApplied.push(filename)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { applied: newlyApplied, failed: `${filename}: ${message}` }
    }
  }

  return { applied: newlyApplied }
}
