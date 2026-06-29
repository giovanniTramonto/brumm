import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

const TEST_DB_URL = process.env.DATABASE_URL
if (!TEST_DB_URL) throw new Error('DATABASE_URL fehlt – .env.test vorhanden?')

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } })

export default async function globalSetup() {
  execSync('npx prisma db push --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL, DIRECT_URL: TEST_DB_URL },
    stdio: 'inherit',
  })

  // Reset
  await prisma.$transaction([
    prisma.session.deleteMany(),
    prisma.magicLink.deleteMany(),
    prisma.invite.deleteMany(),
    prisma.memberDocument.deleteMany(),
    prisma.user.deleteMany(),
    prisma.documentTemplate.deleteMany(),
    prisma.manager.deleteMany(),
    prisma.club.deleteMany(),
  ])

  await prisma.club.create({
    data: {
      slug: 'test-kita',
      name: 'Test Kita',
      adminEmail: 'admin@test.de',
      users: { create: [{ role: 'SUPERUSER' }] },
    },
  })

  await prisma.$disconnect()
}
