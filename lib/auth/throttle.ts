/**
 * Client-side login throttle (brute-force friction / soft account lockout).
 *
 * After 3 wrong passwords for an e-mail, further attempts from this device are
 * blocked for 15 s, then 30 s, 60 s … up to 15 min (exponential backoff). A
 * successful sign-in resets it. This is UX-level protection; the hard limit is
 * Supabase Auth's server-side rate limit on /token (per IP), which an attacker
 * can't bypass by editing the app.
 */

const FREE_ATTEMPTS = 3
const BASE_MS = 15_000
const MAX_MS = 15 * 60_000

type Entry = { failures: number; lockedUntil: number }
const store = new Map<string, Entry>()

const keyOf = (email: string) => email.trim().toLowerCase()

/** Milliseconds until the next attempt is allowed (0 = go ahead). */
export function loginLockRemainingMs(email: string, now = Date.now()): number {
  const e = store.get(keyOf(email))
  return e ? Math.max(0, e.lockedUntil - now) : 0
}

/** Lock duration after the n-th consecutive failure (0 while still free). */
export function lockDurationMs(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0
  return Math.min(MAX_MS, BASE_MS * 2 ** (failures - FREE_ATTEMPTS))
}

export function recordLoginFailure(email: string, now = Date.now()): number {
  const k = keyOf(email)
  const failures = (store.get(k)?.failures ?? 0) + 1
  const lock = lockDurationMs(failures)
  store.set(k, { failures, lockedUntil: now + lock })
  if (store.size > 200) store.delete(store.keys().next().value as string) // bounded memory
  return lock
}

export function resetLoginFailures(email: string) {
  store.delete(keyOf(email))
}
