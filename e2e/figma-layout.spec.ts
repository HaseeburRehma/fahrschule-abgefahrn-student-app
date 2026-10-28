/**
 * Figma "Mobile App" page (GtEHXsLZpwBZVMgqh9cO9j, node 1254:1117) vs the running app.
 * Coordinates are the text boxes from the DE frames; only labels that don't depend on
 * the student's data are checked (plus a few that the demo student's data fixes).
 */
import { expect, test } from '@playwright/test'

import { figmaDiffs, open, type FigmaText } from './helpers'

type Screen = { route: string; frame: string; texts: FigmaText[]; offset?: number }

const SCREENS: Screen[] = [
  {
    route: '/home',
    frame: 'DE/Home',
    texts: [
      ['Willkommen zurück', 20, 60, 145, 20],
      ['Deine Strecke', 39, 143, 132, 22],
      ['zum Führerschein', 39, 165, 175, 22],
      ['NÄCHSTER SCHRITT', 139, 203, 124, 16],
      ['Theorie', 35, 455, 46, 16],
      ['Fahrstunden', 155, 455, 79, 16],
      ['Sonderf.', 275, 455, 51, 16],
      ['Nächster Termin', 39, 521, 137, 20],
      ['Alle', 325, 523, 26, 16],
    ],
  },
  {
    route: '/theory',
    frame: 'DE/Theorie',
    texts: [
      ['Theorie', 20, 60, 103, 30],
      ['Deine 14 Pflichtthemen', 20, 92, 177, 22],
      ['Alle Themen', 20, 241, 104, 20],
      ['Persönliche Voraussetzungen', 85, 288, 238, 40],
      ['Risikofaktor Mensch', 85, 382, 238, 20],
      ['Rechtliche Rahmenbedingungen', 85, 456, 238, 40],
    ],
  },
  {
    route: '/schedule',
    frame: 'DE/Termine',
    texts: [
      ['Termine', 20, 60, 112, 30],
      ['Deine Fahr- & Theoriestunden', 20, 92, 226, 22],
      ['Anstehend', 66, 144, 85, 18],
      ['Vergangen', 238, 144, 86, 18],
    ],
  },
  {
    route: '/progress',
    frame: 'DE/Fortschritt',
    texts: [
      ['Deine Strecke', 20, 60, 190, 30],
      ['zum Führerschein', 20, 90, 251, 30],
      ['Klasse B', 301, 82, 57, 16],
      ['Gesamtfortschritt', 39, 155, 127, 20],
      ['Dein Fahrplan', 20, 304, 117, 20],
      ['Anmeldung', 97, 349, 99, 20],
      ['Abgeschlossen', 97, 377, 108, 20],
      ['Theoriestunden', 97, 461, 131, 20],
      ['Fahrstunden', 97, 573, 107, 20],
      ['Theorieprüfung', 97, 685, 130, 20],
      ['Sonderfahrten', 97, 797, 120, 20],
      ['Praktische Prüfung', 97, 909, 160, 20],
      ['Führerschein', 97, 1021, 109, 20],
      ['Dein großes Ziel', 97, 1049, 116, 20],
    ],
  },
  {
    route: '/profile',
    frame: 'DE/Profil',
    texts: [
      ['Profil', 20, 62, 74, 30],
      ['KONTO', 20, 228, 50, 16],
      ['Profil bearbeiten', 83, 281, 240, 20],
      ['Prüfungstermine', 83, 346, 240, 20],
      ['Dokumente', 83, 411, 240, 20],
      ['APP', 20, 468, 29, 16],
      ['Sprache', 83, 521, 168, 20],
      ['Push-Benachrichtigungen', 83, 578, 214, 40],
      ['Erinnerungen', 83, 655, 214, 20],
      ['FAHRSCHULE', 20, 712, 93, 16],
      ['Info & Kontakt', 83, 765, 240, 20],
      ['Nachricht senden', 83, 830, 240, 20],
    ],
  },
  {
    route: '/booking',
    frame: 'DE/Booking',
    texts: [
      ['Termin anfragen', 76, 67, 192, 26],
      ['Art des Termins', 20, 118, 130, 20],
      ['Fahrstunde', 74, 163, 90, 18],
      ['Datum', 20, 220, 58, 20],
      ['Uhrzeit', 20, 332, 61, 20],
      ['Notiz (optional)', 20, 490, 128, 20],
    ],
  },
  {
    route: '/exams',
    frame: 'DE/Pruefungen',
    texts: [
      ['Prüfungen', 76, 67, 124, 26],
      ['Theorieprüfung', 97, 140, 130, 20],
    ],
  },
  {
    route: '/info',
    frame: 'DE/Info',
    // Figma's placeholder company name fits one line; the real legal name (imprint) wraps
    // to two, so it is checked as a 40pt box and everything below sits 19pt lower.
    texts: [
      ['Info & Kontakt', 76, 67, 167, 26],
      ['Verkehrsfahrschule Abgefahrn 5.0 Düsseldorf GmbH', 39, 180, 273, 40],
      ['Anrufen', 87, 248 + 19, 50, 16],
      ['WhatsApp', 87, 315 + 19, 65, 16],
      ['E-Mail', 87, 381 + 19, 38, 16],
      ['Route', 87, 466 + 19, 37, 16],
      ['ÖFFNUNGSZEITEN', 20, 552 + 19, 126, 16],
      ['Montag – Freitag', 37, 599 + 19, 138, 24],
      ['FOLGE UNS', 20, 722 + 19, 79, 16],
    ],
  },
  {
    route: '/edit-profile',
    frame: '06/Profil bearbeiten',
    texts: [
      ['Profil bearbeiten', 76, 67, 203, 26],
      ['Speichern', 291, 71, 79, 18, 'right'],
      ['Name', 24, 236, 47, 18],
      ['E-Mail', 24, 336, 48, 18],
      ['Telefon', 24, 436, 57, 18],
      ['Geburtsdatum', 24, 536, 114, 18],
    ],
  },
  {
    // bottom-anchored card: same distance from the bottom edge as the 844pt frame → offset 0
    route: '/quiz/6',
    frame: '09/Quiz Intro',
    offset: 0,
    texts: [
      ['Theorie-Quiz', 36, 611, 318, 31, 'center'],
      ['Schaffst du alle 10 Fragen am Stück?', 36, 655, 318, 17, 'center'],
      ['Fragen', 67, 723, 38, 13, 'center'],
      ['Leben', 178, 723, 34, 13, 'center'],
      ['Punkte', 285, 723, 38, 13, 'center'],
      ['Quiz starten', 144, 776, 102, 19, 'center'],
    ],
  },
  {
    route: '/streak',
    frame: '09/Streak',
    offset: 0,
    texts: [
      ['Mo', 60, 734, 17, 13, 'center'],
      ['Di', 106, 734, 11, 13, 'center'],
      ['Mi', 146, 734, 13, 13, 'center'],
      ['Do', 188, 734, 15, 13, 'center'],
      ['Fr', 232, 734, 11, 13, 'center'],
      ['Sa', 272, 734, 14, 13, 'center'],
      ['So', 314, 734, 15, 13, 'center'],
      ['Weiter so!', 153, 776, 84, 19, 'center'],
    ],
  },
  {
    // the app adds a back button above the Figma content (−42pt vs the frame)
    route: '/daily-goal',
    frame: 'DE/Tagesziel',
    offset: 12,
    texts: [
      ['LEKTIONEN', 159, 728, 72, 16, 'center'],
      ['Mo', 20, 910, 20, 16, 'center'],
      ['So', 343, 910, 16, 16, 'center'],
    ],
  },
]

for (const s of SCREENS) {
  test(`${s.frame} matches Figma (${s.route})`, async ({ page }) => {
    await open(page, s.route, 2500)
    const diffs = await figmaDiffs(page, s.texts, s.offset ?? 54)
    expect(diffs, `${s.frame}:\n${diffs.join('\n')}`).toEqual([])
  })
}

test('Figma: no horizontal overflow from 320 to 430pt', async ({ page }) => {
  test.setTimeout(4 * 60_000)
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    for (const route of ['/home', '/progress', '/quiz/6', '/streak', '/daily-goal', '/exams', '/profile']) {
      await open(page, route, 800)
      const sw = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(sw, `${route} at ${width}pt`).toBeLessThanOrEqual(width)
    }
  }
})

test('iPad: the app column holds the mascot stage and the Tagesziel band', async ({ page }) => {
  // the app is a centred column of at most 672pt (APP_MAX_WIDTH); art must be laid out in it
  await page.setViewportSize({ width: 1032, height: 1376 })
  const columnCentre = 1032 / 2
  for (const route of ['/quiz/6', '/streak']) {
    await open(page, route, 1500)
    const lion = await page.getByTestId('float-idle').first().evaluate((el) => {
      const r = el.getBoundingClientRect()
      return r.left + r.width / 2
    })
    expect(Math.abs(lion - columnCentre), `${route}: lion centre ${lion}`).toBeLessThan(4)
  }
  await open(page, '/daily-goal', 1500)
  const sw = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(sw).toBeLessThanOrEqual(1032)
  const band = await page.getByTestId('float-idle').first().evaluate((el) => el.parentElement!.getBoundingClientRect().width)
  expect(band).toBeLessThanOrEqual(672 - 40 + 1)
})
