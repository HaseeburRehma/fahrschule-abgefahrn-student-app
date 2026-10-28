/**
 * End-to-end tests (web build of the app) at the Figma frame size, 390×844.
 *
 *   npm run e2e                      # against the dev server on :8082
 *   E2E_BASE_URL=https://… npm run e2e
 *
 * The "setup" project signs in once and stores the session in e2e/.auth/ (git-ignored).
 * Without E2E_EMAIL / E2E_PASSWORD it opens a browser window and waits for you
 * to sign in by hand — no credentials ever live in the repo.
 */
import { defineConfig } from '@playwright/test'

import { STATE } from './e2e/helpers'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/report' }]],
  outputDir: 'e2e/results',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8082',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'public', testMatch: /public\.spec\.ts/ },
    {
      name: 'student',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts|public\.spec\.ts/,
      use: { storageState: STATE },
    },
  ],
})
