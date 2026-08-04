/**
 * Localized auth-error classification for the passwordless OTP flow.
 * Collapses Supabase's many error shapes into a few user-facing messages.
 */

import type { Locale } from '@/lib/types'

export type AuthErrorKind =
  | 'not_registered'
  | 'invalid_code'
  | 'rate_limited'
  | 'network'
  | 'unknown'

export function classifyAuthError(err: any): AuthErrorKind {
  const msg = String(err?.message ?? err ?? '').toLowerCase()
  const status = Number(err?.status ?? err?.code ?? 0)

  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch'))
    return 'network'
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many'))
    return 'rate_limited'
  // shouldCreateUser:false → unknown emails come back as "signups not allowed"
  // or "user not found" style errors.
  if (
    msg.includes('signups not allowed') ||
    msg.includes('user not found') ||
    msg.includes('not allowed for otp') ||
    msg.includes('email not confirmed') ||
    msg.includes('invalid login')
  )
    return 'not_registered'
  if (
    msg.includes('otp') ||
    msg.includes('token') ||
    msg.includes('expired') ||
    msg.includes('invalid')
  )
    return 'invalid_code'
  return 'unknown'
}

const KEY: Record<AuthErrorKind, string> = {
  not_registered: 'auth.err.notRegistered',
  invalid_code: 'auth.err.invalidCode',
  rate_limited: 'auth.err.rateLimited',
  network: 'auth.err.network',
  unknown: 'auth.err.generic',
}

/** Returns the i18n key for a given error kind (feed into t()). */
export function authErrorKey(kind: AuthErrorKind): string {
  return KEY[kind]
}

// Convenience for contexts without the t() function on hand.
const MESSAGES: Record<AuthErrorKind, { de: string; en: string }> = {
  not_registered: {
    de: 'Diese E-Mail ist nicht registriert. Bitte wende dich an deine Fahrschule.',
    en: 'This email is not registered. Please contact your driving school.',
  },
  invalid_code: {
    de: 'Der Code ist ungültig oder abgelaufen.',
    en: 'The code is invalid or has expired.',
  },
  rate_limited: {
    de: 'Zu viele Versuche. Bitte warte einen Moment.',
    en: 'Too many attempts. Please wait a moment.',
  },
  network: {
    de: 'Keine Verbindung. Bitte prüfe dein Internet.',
    en: 'No connection. Please check your internet.',
  },
  unknown: {
    de: 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.',
    en: 'Sign-in failed. Please try again.',
  },
}

export function authErrorMessage(kind: AuthErrorKind, locale: Locale): string {
  return MESSAGES[kind][locale]
}
