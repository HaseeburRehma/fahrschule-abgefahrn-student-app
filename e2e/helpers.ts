import { expect, type Locator, type Page } from '@playwright/test'

/** Saved student session (git-ignored). */
export const STATE = 'e2e/.auth/student.json'

/**
 * A text from the Figma frame: [text, x, y, width, height] in frame coordinates
 * (390×844 with the 54pt iOS status bar on top), plus how it is aligned in its box.
 */
export type FigmaText = [text: string, x: number, y: number, w: number, h: number, align?: 'left' | 'center' | 'right']

/** Open a route and wait until the app has rendered it (fonts, data, entry animations). */
export async function open(page: Page, route: string, settle = 1500) {
  await page.goto(route)
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page.waitForTimeout(settle)
}

/**
 * Compare the live text boxes with the Figma frame. The web build has no status
 * bar, so a Figma y maps to `y - offset` (54 by default; screens with an extra
 * back button or bottom-anchored cards pass their own offset). Returns one line
 * per text that is missing or more than `tol` pt off (left/centre/right edge
 * horizontally, vertical centre — line-height differences don't count).
 */
export async function figmaDiffs(page: Page, texts: FigmaText[], offset = 54, tol = 3): Promise<string[]> {
  // freeze the idle float so it can't shift anything while we measure
  await page.addStyleTag({ content: '[data-testid="float-idle"]{transform:none!important}' })
  return page.evaluate(
    ({ texts, offset, tol }) => {
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const nodes: Text[] = []
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent?.trim()) nodes.push(n as Text)
      const used = new Set<Text>()
      const out: string[] = []
      for (const [text, x, y, w, h, align = 'left'] of texts) {
        const want = norm(text)
        const node = nodes.find(
          (n) => !used.has(n) && (norm(n.parentElement!.textContent ?? '') === want || norm(n.textContent ?? '') === want),
        )
        if (!node) {
          out.push(`missing "${text}"`)
          continue
        }
        used.add(node)
        const range = document.createRange()
        range.selectNodeContents(node.parentElement!)
        const r = range.getBoundingClientRect()
        const fy = y - offset
        const dx =
          align === 'center' ? r.left + r.width / 2 - (x + w / 2) : align === 'right' ? r.right - (x + w) : r.left - x
        const dy = r.top + r.height / 2 - (fy + h / 2)
        if (Math.abs(dx) > tol || Math.abs(dy) > tol) {
          out.push(`"${text}" off by x ${dx.toFixed(1)} / y ${dy.toFixed(1)} (live ${Math.round(r.left)},${Math.round(r.top)})`)
        }
      }
      return out
    },
    { texts, offset, tol },
  )
}

/** Read a computed style of the first match `n` times, `every` ms apart. */
export async function sample(locator: Locator, prop: string, n = 6, every = 150): Promise<string[]> {
  const values: string[] = []
  for (let i = 0; i < n; i++) {
    values.push(await locator.first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop))
    if (i < n - 1) await locator.page().waitForTimeout(every)
  }
  return values
}

/**
 * Record a computed style of every `[data-testid=testId]` on each animation frame,
 * starting before the page loads (call before `goto`), for `ms` after the first
 * one appears. Short entry animations are over before a normal sample() can start.
 * Read the frames with `recorded(page)`: one array per frame, one value per element.
 */
export async function recordFromLoad(page: Page, testId: string, prop: string, ms = 2000) {
  await page.addInitScript(
    ({ testId, prop, ms }) => {
      const frames: string[][] = []
      ;(window as any).__rec = frames
      let first = 0
      const tick = () => {
        const els = document.querySelectorAll(`[data-testid="${testId}"]`)
        if (els.length) {
          if (!first) first = performance.now()
          frames.push(Array.from(els, (e) => getComputedStyle(e).getPropertyValue(prop)))
        }
        if (!first || performance.now() - first < ms) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    },
    { testId, prop, ms },
  )
}

export async function recorded(page: Page): Promise<string[][]> {
  return page.evaluate(() => (window as any).__rec ?? [])
}

/** The values one element (by index) went through, from the recorded frames. */
export function column(frames: string[][], i: number) {
  return frames.filter((f) => f.length > i).map((f) => f[i])
}

/** First visible element with this text (hidden screens stay mounted in the navigation stack). */
export function visibleText(page: Page, text: string) {
  return page.locator(`text=${text} >> visible=true`).first()
}

/** The signed-in account's role as stored in its session (students have none / "student"). */
export async function sessionRole(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.endsWith('-auth-token')) return JSON.parse(localStorage.getItem(k) ?? '{}')?.user?.user_metadata?.role
    }
    return undefined
  })
}

/** true when at least two samples differ, i.e. something is animating. */
export function moves(values: string[]) {
  return new Set(values).size > 1
}

/** Fail the test on uncaught page errors (React crashes, failed imports …). */
export function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return {
    assertNone: () => expect(errors, errors.join('\n')).toEqual([]),
  }
}
