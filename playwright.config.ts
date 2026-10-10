import { defineConfig, devices } from '@playwright/test'

/**
 * Web e2e for FEXevo against a local BEXevo in fakes mode (see e2e/README.md).
 * `pnpm e2e` runs everything except @live; `pnpm e2e:live` runs only @live (real providers).
 */
export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 8090)
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3050'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // One shared set of seeded accounts, so specs run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    ...devices['iPhone 14'],
    browserName: 'chromium',
    // Bundled Chromium has no H.264, so specs check videos by fetching them, not by playing them.
    // Headless Google Chrome (E2E_BROWSER_CHANNEL=chrome) stalls on this app's video screens on macOS.
    ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}),
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'en', use: { locale: 'en-US' } },
    // Spanish UI (device locale): the same controls must still be found by test id.
    { name: 'es', use: { locale: 'es-ES' }, testMatch: /(onboarding-auth|technique)\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'pnpm --dir ../BEXevo dev:e2e',
      url: `${API_URL}/__e2e/health`,
      reuseExistingServer: true,
      timeout: 240_000,
    },
    {
      command: `pnpm web:export:e2e && npx -y serve@14 -s dist-web -l ${WEB_PORT} --no-port-switching`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: true,
      timeout: 600_000,
    },
  ],
})
