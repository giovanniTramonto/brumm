import { defineConfig, devices } from '@playwright/test'

function env(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Umgebungsvariable ${key} fehlt – .env.smoke vorhanden?`)
  return value
}

export default defineConfig({
  testDir: './tests/specs',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: env('APP_URL'),
    trace: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
