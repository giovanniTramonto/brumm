import { defineConfig, devices } from '@playwright/test'

function env(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Umgebungsvariable ${key} fehlt – .env.test vorhanden?`)
  return value
}

const BASE_URL = env('APP_URL')

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `nuxt dev --port ${new URL(BASE_URL).port}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: env('DATABASE_URL'),
      DIRECT_URL: env('DIRECT_URL'),
      RESEND_API_KEY: env('RESEND_API_KEY'),
      EMAIL_FROM: env('EMAIL_FROM'),
      ADMIN_SECRET: env('ADMIN_SECRET'),
      APP_URL: env('APP_URL'),
      GOOGLE_CLIENT_ID: env('GOOGLE_CLIENT_ID'),
      GOOGLE_CLIENT_SECRET: env('GOOGLE_CLIENT_SECRET'),
    },
  },
  globalSetup: './tests/global-setup.ts',
})
