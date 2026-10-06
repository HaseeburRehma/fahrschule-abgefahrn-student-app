/**
 * Tiny in-memory request cache with TTL + in-flight de-duplication.
 *
 * Tab screens refetch on focus; without this, switching Start → Theorie → Start
 * re-downloads the same rows every time. Mutations invalidate their prefix,
 * pull-to-refresh clears everything, sign-out drops all cached data.
 */

type Entry = { at: number; promise: Promise<unknown> }

const store = new Map<string, Entry>()

export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise as Promise<T>
  const promise = fn().catch((err) => {
    // never cache failures
    if (store.get(key)?.promise === promise) store.delete(key)
    throw err
  })
  store.set(key, { at: Date.now(), promise })
  return promise
}

/** Drop every entry whose key starts with one of the prefixes (no args = everything). */
export function invalidateCache(...prefixes: string[]): void {
  if (!prefixes.length) {
    store.clear()
    return
  }
  for (const k of [...store.keys()]) {
    if (prefixes.some((p) => k.startsWith(p))) store.delete(k)
  }
}
