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
    prisma.userEmail.deleteMany(),
    prisma.user.deleteMany(),
    prisma.documentTemplate.deleteMany(),
    prisma.manager.deleteMany(),
    prisma.club.deleteMany(),
  ])

  // Seed: Verein ohne Drive-Setup (localData-Modus)
  const club = await prisma.club.create({
    data: { slug: 'test-kita', name: 'Test Kita', isSetupDone: false },
  })

  const superuser = await prisma.user.create({
    data: { clubId: club.id, role: 'SUPERUSER', isActive: true },
  })

  await prisma.userEmail.create({
    data: { userId: superuser.id, email: 'admin@test.de', isPrimary: true },
  })

  await prisma.$disconnect()
}
