/**
 * Signs the test student in once and saves the session for the "student" project.
 *
 * - E2E_EMAIL + E2E_PASSWORD set → fills the login form (CI).
 * - otherwise → opens a visible window and waits up to 30 min for a manual sign-in.
 * A saved session is reused until E2E_RELOGIN=1 (Supabase refreshes the token itself).
 */
import fs from 'node:fs'
import path from 'node:path'
import { expect, test as setup } from '@playwright/test'

import { STATE } from './helpers'

const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const manual = !email || !password

if (manual) setup.use({ headless: false })

setup('student session', async ({ page }) => {
  if (fs.existsSync(STATE) && process.env.E2E_RELOGIN !== '1') {
    setup.skip(true, `reusing ${STATE} (E2E_RELOGIN=1 to sign in again)`)
  }
  setup.setTimeout(31 * 60_000)

  await page.goto('/login')
  if (!manual) {
    await page.getByPlaceholder('deine@email.de').fill(email!)
    await page.locator('input[type=password]').fill(password!)
    await page.getByRole('button', { name: 'Anmelden' }).click()
  } else {
    console.log('\n>>> Sign in as the test student in the opened window (30 min) …\n')
  }

  // Signed in = Supabase has stored a session. Report progress so a stuck run is easy to read.
  const deadline = Date.now() + 30 * 60_000
  let last = 0
  for (;;) {
    const signedIn = await page
      .evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token')))
      .catch(() => false)
    if (signedIn) break
    if (Date.now() > deadline) throw new Error('No sign-in within 30 minutes')
    if (Date.now() - last > 20_000) {
      console.log(`  waiting for sign-in … window is at ${new URL(page.url()).pathname}`)
      last = Date.now()
    }
    await page.waitForTimeout(2000)
  }
  await page.goto('/home')
  await expect(page.getByText('Willkommen zurück')).toBeVisible()

  fs.mkdirSync(path.dirname(STATE), { recursive: true })
  await page.context().storageState({ path: STATE })
})
