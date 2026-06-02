import { expect, test } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const TEST_DB_URL =
  process.env.DATABASE_URL ??
  (() => {
    throw new Error('DATABASE_URL fehlt')
  })()
const SLUG = 'test-kita'
const SUPERUSER_EMAIL = 'admin@test.de'

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } })

test.afterAll(async () => {
  await prisma.$disconnect()
})

test('SUPERUSER Login via Magic Link', async ({ page }) => {
  await page.goto(`/login/${SLUG}`)
  await page.fill('input[type="email"]', SUPERUSER_EMAIL)
  await page.click('button[type="submit"]')

  // Magic Link aus DB holen (kein echter E-Mail-Versand nötig)
  const magicLink = await prisma.magicLink.findFirst({
    orderBy: { createdAt: 'desc' },
  })
  expect(magicLink).not.toBeNull()

  if (!magicLink) throw new Error('Kein Magic Link in der DB gefunden')
  await page.goto(`/ini/${SLUG}/auth/verify/${magicLink.token}`)
  await expect(page).toHaveURL(new RegExp(`/ini/${SLUG}/`))
})
