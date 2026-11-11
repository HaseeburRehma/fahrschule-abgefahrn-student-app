import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ getSupabase: () => ({}) }))
vi.mock('react-native', () => ({ Linking: {}, Platform: { OS: 'web' } }))
vi.mock('expo-web-browser', () => ({}))

import { lockDurationMs, loginLockRemainingMs, recordLoginFailure, resetLoginFailures } from '../lib/auth/throttle'
import { DEFAULT_FLAGS, parseFlags } from '../lib/flags'
import { isRetryable, newIdempotencyKey } from '../lib/invites'
import { safeDocumentExt } from '../lib/documents'

describe('login throttle (brute-force friction)', () => {
  it('allows three tries, then backs off exponentially up to 15 minutes', () => {
    expect([1, 2].map(lockDurationMs)).toEqual([0, 0])
    expect([3, 4, 5].map(lockDurationMs)).toEqual([15_000, 30_000, 60_000])
    expect(lockDurationMs(20)).toBe(15 * 60_000)
  })

  it('locks per e-mail (case-insensitive) and resets after a successful login', () => {
    const t0 = 1_000_000
    for (let i = 0; i < 3; i++) recordLoginFailure('Max@Test.de', t0)
    expect(loginLockRemainingMs('max@test.de', t0 + 5_000)).toBe(10_000)
    expect(loginLockRemainingMs('other@test.de', t0)).toBe(0)
    expect(loginLockRemainingMs('max@test.de', t0 + 16_000)).toBe(0)
    resetLoginFailures('MAX@test.de')
    expect(loginLockRemainingMs('max@test.de', t0)).toBe(0)
  })
})

describe('feature flags', () => {
  it('defaults to on and only accepts known flags', () => {
    expect(parseFlags(null)).toEqual(DEFAULT_FLAGS)
    expect(parseFlags([{ key: 'invite_emails', enabled: false }, { key: 'evil', enabled: false }])).toEqual({ ...DEFAULT_FLAGS, invite_emails: false })
  })
})

describe('idempotent retries', () => {
  it('makes RFC-4122 v4 keys that differ every time', () => {
    const a = newIdempotencyKey()
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(newIdempotencyKey()).not.toBe(a)
  })

  it('retries only transient failures', () => {
    expect([null, 408, 429, 500, 503].every(isRetryable)).toBe(true)
    expect([400, 401, 403, 404, 409, 413].some(isRetryable)).toBe(false)
  })
})

describe('upload safety', () => {
  it('derives the stored extension from the validated MIME type, never the filename', () => {
    expect(safeDocumentExt('application/pdf')).toBe('pdf')
    expect(safeDocumentExt('IMAGE/JPEG')).toBe('jpg')
    expect(safeDocumentExt('text/html')).toBe('bin')
    expect(safeDocumentExt(null)).toBe('bin')
  })
})
