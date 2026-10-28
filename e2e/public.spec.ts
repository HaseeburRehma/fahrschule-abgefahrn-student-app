/** Signed-out screens (Figma "Onboarding & Auth — DE"). */
import { expect, test } from '@playwright/test'

import { figmaDiffs, open, type FigmaText } from './helpers'

const SCREENS: { route: string; frame: string; texts: FigmaText[] }[] = [
  {
    route: '/welcome',
    frame: 'DE/Onboarding 1',
    texts: [
      ['Überspringen', 263, 64, 107, 18, 'right'],
      ['Dein Weg zum', 32, 440, 326, 38, 'center'],
      ['Führerschein', 32, 478, 326, 46, 'center'],
      ['Theorie, Fahrstunden, Sonderfahrten und Prüfungen – alles an einem Ort.', 32, 538, 326, 48, 'center'],
    ],
  },
  {
    route: '/login',
    frame: 'DE/Login',
    texts: [
      ['Willkommen', 24, 145, 232, 38],
      ['zurück', 24, 185, 96, 30],
      ['Melde dich an und mach weiter auf deiner Strecke zum Führerschein.', 24, 227, 342, 48],
      ['E-Mail', 24, 301, 48, 18],
      ['Passwort', 24, 401, 72, 18],
      ['Passwort vergessen?', 24, 501, 342, 18, 'right'],
      ['Anmelden', 136, 546, 87, 20, 'center'],
    ],
  },
  {
    route: '/signup',
    frame: 'DE/SignUp',
    texts: [
      ['Starte deine', 24, 121, 219, 38],
      ['Ausbildung', 24, 161, 160, 30],
      ['Name', 24, 209, 47, 18],
      ['E-Mail', 24, 307, 48, 18],
      ['Passwort', 24, 405, 72, 18],
      ['Fahrschul-Code', 24, 503, 122, 18],
      ['Konto erstellen', 117, 666, 126, 20, 'center'],
    ],
  },
  {
    route: '/forgot',
    frame: '05/Passwort vergessen',
    texts: [
      ['Passwort vergessen', 76, 67, 232, 26],
      ['Passwort', 24, 130, 168, 38],
      ['zurücksetzen', 24, 168, 188, 30],
      ['E-Mail', 24, 286, 48, 18],
      ['Link senden', 130, 399, 101, 20, 'center'],
    ],
  },
]

for (const s of SCREENS) {
  test(`${s.frame} matches Figma (${s.route})`, async ({ page }) => {
    await open(page, s.route)
    const diffs = await figmaDiffs(page, s.texts)
    expect(diffs, `${s.frame}:\n${diffs.join('\n')}`).toEqual([])
  })
}

test('sign-up: password rule appears only once typing starts', async ({ page }) => {
  await open(page, '/signup')
  const rule = page.getByText(/Mind\. 8 Zeichen, mit Buchstaben und Zahl/)
  await expect(rule).toHaveCount(0)
  await page.locator('input[type=password]').fill('a')
  await expect(rule).toBeVisible()
})

test('login: focused field shows the green border, no browser focus ring', async ({ page }) => {
  await open(page, '/login')
  const email = page.getByPlaceholder('deine@email.de')
  await email.focus()
  await expect(email).toHaveCSS('outline-style', 'none')
})

test('onboarding: Weiter walks through the three slides to sign-up/login', async ({ page }) => {
  await open(page, '/welcome')
  for (let i = 0; i < 3; i++) {
    const next = page.getByRole('button', { name: /Weiter|Los geht/ })
    if (!(await next.isVisible())) break
    await next.click()
    await page.waitForTimeout(400)
  }
  await expect(page).toHaveURL(/\/(welcome|login|signup)$/)
})
