import { expect, test } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const DB_URL =
  process.env.DATABASE_URL ??
  (() => {
    throw new Error('DATABASE_URL fehlt')
  })()

const SLUG =
  process.env.SMOKE_SLUG ??
  (() => {
    throw new Error('SMOKE_SLUG fehlt')
  })()

const SUPERUSER_EMAIL =
  process.env.SMOKE_EMAIL ??
  (() => {
    throw new Error('SMOKE_EMAIL fehlt')
  })()

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } })

test.afterAll(async () => {
  await prisma.$disconnect()
})

test('SUPERUSER Login via Magic Link', async ({ page }) => {
  await page.goto(`/login/${SLUG}`)
  await page.fill('input[type="email"]', SUPERUSER_EMAIL)

  await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('/auth/magic-link') && resp.status() === 200,
    ),
    page.click('button[type="submit"]'),
  ])

  const magicLink = await prisma.magicLink.findFirst({
    orderBy: { createdAt: 'desc' },
  })
  if (!magicLink) throw new Error('Kein Magic Link in der DB gefunden')

  await page.goto(`/ini/${SLUG}/auth/verify/${magicLink.token}`)
  await expect(page).toHaveURL(new RegExp(`/ini/${SLUG}/dashboard`), { timeout: 15000 })
  await expect(page.getByRole('heading', { name: /Willkommen/ })).toBeVisible()
})
