import { createDecipheriv } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import postgres from 'postgres'

const prisma = new PrismaClient()

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) throw new Error('ENCRYPTION_KEY not set')
  const key = Buffer.from(hex, 'hex')
  if (key.length !== KEY_BYTES) throw new Error('ENCRYPTION_KEY must be 32 bytes')
  return key
}

function decrypt(ciphertext: string): string {
  const key = getKey()
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':')
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  return decipher.update(Buffer.from(encryptedHex, 'hex')).toString('utf8') + decipher.final('utf8')
}

async function runMigrations(
  sql: ReturnType<typeof postgres>,
): Promise<{ applied: string[]; failed?: string }> {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL      PRIMARY KEY,
      filename   TEXT        UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  const applied = await sql<{ filename: string }[]>`SELECT filename FROM _migrations ORDER BY id`
  const appliedSet = new Set(applied.map((r) => r.filename))

  const dir = join(process.cwd(), 'server/utils/migrations/sql')
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  const newlyApplied: string[] = []

  for (const filename of files) {
    if (appliedSet.has(filename)) continue
    try {
      const content = await readFile(join(dir, filename), 'utf8')
      await sql.begin(async (tx) => {
        await tx.unsafe(content)
        await tx`INSERT INTO _migrations (filename) VALUES (${filename})`
      })
      newlyApplied.push(filename)
    } catch (err) {
      return {
        applied: newlyApplied,
        failed: `${filename}: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }
  return { applied: newlyApplied }
}

export default async () => {
  const records = await prisma.clubDatabase.findMany({
    where: { type: 'POSTGRES', encryptedDsn: { not: null } },
  })

  console.log(`[deploy-succeeded] Migrating ${records.length} club database(s)…`)

  for (const record of records) {
    let sql: ReturnType<typeof postgres> | undefined
    try {
      if (!record.encryptedDsn) continue
      const dsn = decrypt(record.encryptedDsn)
      sql = postgres(dsn, { max: 2, connect_timeout: 10 })
      const result = await runMigrations(sql)

      if (result.failed) {
        await prisma.auditLog.create({
          data: {
            clubId: record.clubId,
            event: 'DEPLOY_MIGRATION_FAILED',
            severity: 'ERROR',
            metadata: { reason: result.failed },
          },
        })
        console.error(`[deploy-succeeded] ${record.clubId}: migration failed — ${result.failed}`)
      } else if (result.applied.length > 0) {
        await prisma.auditLog.create({
          data: {
            clubId: record.clubId,
            event: 'DEPLOY_MIGRATION_DONE',
            severity: 'INFO',
            metadata: { applied: result.applied },
          },
        })
        console.log(`[deploy-succeeded] ${record.clubId}: applied ${result.applied.join(', ')}`)
      }
    } catch (err) {
      await prisma.auditLog.create({
        data: {
          clubId: record.clubId,
          event: 'DEPLOY_MIGRATION_FAILED',
          severity: 'ERROR',
          metadata: { reason: err instanceof Error ? err.message : String(err) },
        },
      })
      console.error(`[deploy-succeeded] ${record.clubId}: ${err}`)
    } finally {
      await sql?.end()
    }
  }

  await prisma.$disconnect()
}
