/**
 * Signed-in student journeys. Nothing here writes to the database: the quiz is
 * left before its result is saved, and the booking request is never sent.
 */
import { expect, test } from '@playwright/test'

import { open, sessionRole, trackErrors, visibleText } from './helpers'

test('tab bar reaches every main screen', async ({ page }) => {
  const errors = trackErrors(page)
  await open(page, '/home')
  for (const [tab, path, heading] of [
    ['Theorie', '/theory', 'Deine 14 Pflichtthemen'],
    ['Termine', '/schedule', 'Deine Fahr- & Theoriestunden'],
    ['Fortschritt', '/progress', 'Dein Fahrplan'],
    ['Profil', '/profile', 'KONTO'],
    ['Start', '/home', 'Willkommen zurück'],
  ] as const) {
    await page.getByRole('tab', { name: tab }).or(page.getByRole('link', { name: tab })).first().click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.getByText(heading, { exact: true }).first()).toBeVisible()
  }
  errors.assertNone()
})

test('home quick access opens Theorie, Prüfungen, Dokumente, Chat, Tagesziel and Liga', async ({ page }) => {
  const errors = trackErrors(page)
  for (const [tile, path, check] of [
    ['Prüfungen', '/exams', 'VORAUSSETZUNGEN'],
    ['Dokumente', '/documents', 'Dokumente'],
    ['Nachrichten', '/chat', 'Fahrschule Abgefahrn'],
    ['Theorie-Quiz', '/daily-goal', 'LEKTIONEN'],
    ['Liga', '/league', 'Fahrschüler-Liga'],
  ] as const) {
    await open(page, '/home', 800)
    await page.getByText(tile, { exact: true }).last().click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(visibleText(page, check)).toBeVisible()
  }
  errors.assertNone()
})

test('streak chip on home opens the streak celebration and closes again', async ({ page }) => {
  await open(page, '/home')
  await page.getByLabel(/Tage in Folge/).first().click()
  await expect(page).toHaveURL(/\/streak$/)
  await expect(page.getByText(/Streak/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Weiter so!' }).click()
  await expect(page).toHaveURL(/\/home$/)
})

test('theory topic → detail → topic quiz intro', async ({ page }) => {
  await open(page, '/theory')
  await page.getByText('Verkehrszeichen & Einrichtungen', { exact: false }).first().click()
  await expect(page).toHaveURL(/\/theory\/[0-9a-f-]+$/)
  await expect(page.getByText(/Worum geht/)).toBeVisible()
  await page.getByText('Quiz zu diesem Thema').click()
  await expect(page).toHaveURL(/\/quiz\/6$/)
  await expect(page.getByRole('button', { name: 'Quiz starten' })).toBeVisible()
})

test('quiz: start → Grünes Licht → answer → feedback → next question → leave', async ({ page }) => {
  const errors = trackErrors(page)
  await open(page, '/quiz/6')
  await expect(page.getByText('Theorie-Quiz')).toBeVisible()
  await expect(page.getByText('Fragen', { exact: true })).toBeVisible()
  await expect(page.getByText('Leben', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Quiz starten' }).click()

  // "Grünes Licht" countdown, then the first question
  await expect(page.getByTestId('green-light')).toBeVisible()
  await expect(page.getByTestId('green-light')).toBeHidden({ timeout: 4000 })
  const check = page.getByRole('button', { name: 'Prüfen' })
  await expect(check).toBeVisible()

  const lives = page.getByLabel(/Leben/).first()
  const livesBefore = await lives.getAttribute('aria-label')

  // answer the first question
  const options = page.locator('[role=radio],[role=checkbox]')
  expect(await options.count()).toBeGreaterThanOrEqual(2)
  await options.first().click()
  await check.click()

  // feedback sheet with the lion tile and a verdict
  await expect(page.getByText(/^(Richtig!|Leider falsch)$/)).toBeVisible()
  await expect(page.getByTestId('pop-in').first()).toBeVisible()
  const wrong = await page.getByText('Leider falsch').isVisible()
  if (wrong) {
    await expect(page.getByText(/^Richtig ist:/)).toBeVisible()
    await expect(lives).not.toHaveAttribute('aria-label', livesBefore ?? '')
  }

  // next question
  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(check).toBeVisible()
  await expect(page.getByText(/^(Richtig!|Leider falsch)$/)).toBeHidden()

  // leaving asks first, then returns
  await page.getByRole('button', { name: 'Quiz beenden' }).first().click()
  await expect(page.getByText('Quiz wirklich beenden?')).toBeVisible()
  await page.getByRole('button', { name: 'Quiz beenden' }).last().click()
  await expect(page).not.toHaveURL(/\/quiz\//)
  errors.assertNone()
})

test('Tagesziel shows ring, week row and "Weiterlernen" into the next quiz', async ({ page }) => {
  await open(page, '/daily-goal')
  await expect(page.getByText('LEKTIONEN')).toBeVisible()
  await expect(page.getByText(/^Tagesziel/)).toBeVisible()
  for (const d of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) await expect(page.getByText(d, { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /Weiterlernen/ }).click()
  await expect(page).toHaveURL(/\/quiz\/\d+$/)
})

test('league and badges load for the student', async ({ page }) => {
  await open(page, '/league')
  await expect(page.getByText('Fahrschüler-Liga')).toBeVisible()
  // the league ranks students; staff accounts aren't listed
  if ((await sessionRole(page)) !== 'admin') await expect(page.getByText(/\(Du\)|\(You\)/)).toBeVisible()
  await open(page, '/badges')
  await expect(page.getByText('Abzeichen', { exact: true })).toBeVisible()
  await expect(page.getByText(/von \d+ freigeschaltet/)).toBeVisible()
})

test('appointment: list → detail with route and cancel action (not sent)', async ({ page }) => {
  await open(page, '/schedule')
  test.skip(await page.getByText('Keine anstehenden Termine').isVisible(), 'no upcoming appointment for this account')
  await visibleText(page, 'Fahrstunde').click()
  await expect(page).toHaveURL(/\/appointment\//)
  await expect(page.getByText('FAHRLEHRER')).toBeVisible()
  await expect(page.getByText('Route öffnen')).toBeVisible()
  await page.getByRole('button', { name: 'Termin absagen' }).click()
  await expect(page.getByRole('dialog').or(page.getByText(/absagen\?/)).first()).toBeVisible()
})

test('booking form opens and offers the lesson types (request is not sent)', async ({ page }) => {
  await open(page, '/booking')
  await expect(page.getByText('Art des Termins')).toBeVisible()
  await expect(page.getByText('Fahrstunde', { exact: true })).toBeVisible()
  await expect(page.getByText('Datum', { exact: true })).toBeVisible()
  await expect(page.getByText('Uhrzeit', { exact: true })).toBeVisible()
})

test('profile: language and logout sheets open and close without changes', async ({ page }) => {
  await open(page, '/profile')
  await page.getByText('Sprache', { exact: true }).click()
  await expect(page.getByText('English')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByText('Abmelden', { exact: true }).click()
  await expect(page.getByText(/wirklich abmelden|Abmelden\?/i)).toBeVisible()
})

test('theory detail keeps long German titles unbroken', async ({ page }) => {
  await open(page, '/theory')
  await page.getByText('Vorfahrt & Verkehrsregelungen').first().click()
  await expect(page).toHaveURL(/\/theory\//)
  const title = page.getByText('Vorfahrt & Verkehrsregelungen', { exact: true }).last()
  const lines = await title.evaluate((el) => {
    const r = document.createRange()
    r.selectNodeContents(el)
    return new Set(Array.from(r.getClientRects()).map((c) => Math.round(c.top))).size
  })
  // "Vorfahrt &" + "Verkehrsregelungen" — never a third line from a split word
  expect(lines).toBeLessThanOrEqual(2)
})
