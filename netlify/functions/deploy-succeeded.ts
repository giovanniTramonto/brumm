import { createDecipheriv } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import postgres from 'postgres'
import { runMigrations } from '../../server/utils/migrations/runner'

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

export default async () => {
  const clubs = await prisma.club.findMany({
    where: { encryptedDsn: { not: null } },
    select: { id: true, encryptedDsn: true },
  })

  console.log(`[deploy-succeeded] Migrating ${clubs.length} club database(s)…`)

  for (const club of clubs) {
    let sql: ReturnType<typeof postgres> | undefined
    try {
      if (!club.encryptedDsn) continue
      const dsn = decrypt(club.encryptedDsn)
      sql = postgres(dsn, { max: 2, connect_timeout: 10, ssl: { rejectUnauthorized: false } })
      const result = await runMigrations(sql)

      if (result.failed) {
        await prisma.auditLog.create({
          data: {
            clubId: club.id,
            event: 'DEPLOY_MIGRATION_FAILED',
            severity: 'ERROR',
            metadata: { reason: result.failed },
          },
        })
        console.error(`[deploy-succeeded] ${club.id}: migration failed — ${result.failed}`)
      } else if (result.applied.length > 0) {
        await prisma.auditLog.create({
          data: {
            clubId: club.id,
            event: 'DEPLOY_MIGRATION_DONE',
            severity: 'INFO',
            metadata: { applied: result.applied },
          },
        })
        console.log(`[deploy-succeeded] ${club.id}: applied ${result.applied.join(', ')}`)
      }
    } catch (err) {
      await prisma.auditLog.create({
        data: {
          clubId: club.id,
          event: 'DEPLOY_MIGRATION_FAILED',
          severity: 'ERROR',
          metadata: { reason: err instanceof Error ? err.message : String(err) },
        },
      })
      console.error(`[deploy-succeeded] ${club.id}: ${err}`)
    } finally {
      await sql?.end()
    }
  }

  await prisma.$disconnect()
}
