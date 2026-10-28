/**
 * Figma animation boards ("09 · Anim/…", "12 · Animationen") → components/ds/motion.tsx:
 * Strecke-/Streak-Puls (PulseRing), Fortschritt/Vollgas (useFill), Maskottchen
 * (FloatIdle), Grünes Licht, PopIn — and the Reduce Motion fallback.
 */
import { expect, test } from '@playwright/test'

import { column, moves, open, recordFromLoad, recorded, sample } from './helpers'

test('Strecke-Puls: the current step on Home breathes', async ({ page }) => {
  await open(page, '/home')
  const ring = page.getByTestId('pulse-ring')
  await expect(ring.first()).toBeAttached()
  expect(moves(await sample(ring, 'transform'))).toBe(true)
  expect(moves(await sample(ring, 'opacity'))).toBe(true)
})

test('Fortschritt: the Home ring arc fills up from empty', async ({ page }) => {
  await page.goto('/home')
  const arc = page.getByTestId('progress-ring-arc').locator('circle')
  await expect(arc.first()).toBeAttached()
  const offsets = (await sample(arc, 'stroke-dashoffset', 10, 120)).map((v) => parseFloat(v))
  const first = offsets[0]
  const last = offsets[offsets.length - 1]
  expect(last).toBeLessThan(first) // offset shrinks = arc grows
  // and it settles (no endless loop)
  await page.waitForTimeout(800)
  const settled = (await sample(arc, 'stroke-dashoffset', 3, 150)).map((v) => parseFloat(v))
  expect(new Set(settled).size).toBe(1)
})

test('Vollgas: Fortschritt bars grow from 0', async ({ page }) => {
  await recordFromLoad(page, 'progress-bar-fill', 'width', 1500)
  await open(page, '/progress', 2000)
  const frames = await recorded(page)
  expect(frames.length).toBeGreaterThan(5)
  // the widest bar (Gesamtfortschritt) must start narrower than it ends
  const last = frames[frames.length - 1].map(parseFloat)
  const widest = last.indexOf(Math.max(...last))
  const widths = column(frames, widest).map(parseFloat)
  expect(Math.min(...widths)).toBeLessThan(widths[widths.length - 1] * 0.5)
})

test('Maskottchen: the lion floats on the quiz intro', async ({ page }) => {
  await open(page, '/quiz/6')
  const lion = page.getByTestId('float-idle')
  await expect(lion.first()).toBeAttached()
  expect(moves(await sample(lion, 'transform', 6, 250))).toBe(true)
})

test('Grünes Licht: lamps light up one by one, then LOS!', async ({ page }) => {
  await recordFromLoad(page, 'green-light-lamp', 'background-color', 1600)
  await open(page, '/quiz/6')
  await page.getByRole('button', { name: 'Quiz starten' }).click()
  await expect(page.getByText('LOS!')).toBeAttached()
  await expect(page.getByTestId('green-light')).toBeHidden({ timeout: 4000 })
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible()

  const frames = await recorded(page)
  expect(frames[0]).toHaveLength(3)
  // each lamp changes colour (dark → lit), the first one earlier than the last
  const changedAt = [0, 1, 2].map((i) => column(frames, i).findIndex((c) => c !== frames[0][i]))
  expect(changedAt.every((n) => n > 0)).toBe(true)
  expect(changedAt[0]).toBeLessThan(changedAt[2])
  // and the last lamp ends brand green
  expect(column(frames, 2).at(-1)).toBe('rgb(0, 255, 36)')
})

test('PopIn: the feedback lion tile pops in', async ({ page }) => {
  await open(page, '/quiz/6')
  await page.getByRole('button', { name: 'Quiz starten' }).click()
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible({ timeout: 5000 })
  await page.locator('[role=radio],[role=checkbox]').first().click()
  await page.getByRole('button', { name: 'Prüfen' }).click()
  const tile = page.getByTestId('pop-in').first()
  const opacities = (await sample(tile, 'opacity', 6, 60)).map(Number)
  expect(opacities[0]).toBeLessThan(1)
  await expect(tile).toHaveCSS('opacity', '1')
})

test('Streak-Puls: today on the streak card breathes', async ({ page }) => {
  await open(page, '/streak')
  expect(moves(await sample(page.getByTestId('pulse-ring'), 'transform'))).toBe(true)
})

test.describe('Reduce Motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  test('no pulse rings, no float, and the quiz starts without the countdown', async ({ page }) => {
    await open(page, '/home')
    await expect(page.getByTestId('pulse-ring')).toHaveCount(0)
    await open(page, '/quiz/6')
    const lion = page.getByTestId('float-idle')
    expect(moves(await sample(lion, 'transform', 4, 250))).toBe(false)
    await page.getByRole('button', { name: 'Quiz starten' }).click()
    await expect(page.getByTestId('green-light')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible()
  })
})
