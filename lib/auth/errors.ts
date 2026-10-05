/**
 * Localized auth-error classification.
 *   - classifyAuthError / authErrorKey / authErrorMessage: legacy passwordless OTP flow.
 *   - classifyPasswordError / passwordErrorKey: email + password flow (login, reset,
 *     update password) — keys live in lib/i18n/v2/auth.ts.
 *   - readFunctionError: unwraps a supabase-js `functions.invoke` error (signup-with-code).
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

/* ------------------------------------------------------------------ password flow */

export type PasswordErrorKind =
  | 'invalid_credentials'
  | 'unconfirmed'
  | 'weak_password'
  | 'same_password'
  | 'rate_limited'
  | 'network'
  | 'unknown'

function isNetworkish(err: any, msg: string) {
  const name = String(err?.name ?? '')
  return (
    name === 'AuthRetryableFetchError' ||
    name === 'FunctionsFetchError' ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetch failed') ||
    msg.includes('load failed') ||
    msg.includes('timeout')
  )
}

export function classifyPasswordError(err: any): PasswordErrorKind {
  const msg = String(err?.message ?? err ?? '').toLowerCase()
  const code = String(err?.code ?? '').toLowerCase()
  const status = Number(err?.status ?? 0)

  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || status === 429 ||
      msg.includes('rate limit') || msg.includes('too many') || msg.includes('for security purposes'))
    return 'rate_limited'
  if (isNetworkish(err, msg)) return 'network'
  if (code === 'invalid_credentials' || msg.includes('invalid login') || msg.includes('invalid credentials'))
    return 'invalid_credentials'
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) return 'unconfirmed'
  if (code === 'same_password' || msg.includes('should be different')) return 'same_password'
  if (code === 'weak_password' || msg.includes('weak') || msg.includes('password should'))
    return 'weak_password'
  return 'unknown'
}

const PASSWORD_KEY: Record<PasswordErrorKind, string> = {
  invalid_credentials: 'auth.err.invalidCredentials',
  unconfirmed: 'auth.err.unconfirmed',
  weak_password: 'auth.err.weakPassword',
  same_password: 'auth.err.samePassword',
  rate_limited: 'auth.err.rateLimited',
  network: 'auth.err.network',
  unknown: 'auth.err.generic',
}

export function passwordErrorKey(kind: PasswordErrorKind): string {
  return PASSWORD_KEY[kind]
}

/**
 * supabase-js v2 `functions.invoke` errors: FunctionsHttpError carries the Response in
 * `error.context` — read its JSON body (`{ error: 'invalid_code' }`) and status.
 */
export async function readFunctionError(
  error: any,
): Promise<{ status: number; code: string; network: boolean }> {
  const msg = String(error?.message ?? '').toLowerCase()
  if (isNetworkish(error, msg) && !error?.context?.status) return { status: 0, code: 'network', network: true }
  const res = error?.context
  const status = Number(res?.status ?? 0)
  let code = ''
  try {
    if (res && typeof res.json === 'function') {
      const body = await (typeof res.clone === 'function' ? res.clone() : res).json()
      code = String(body?.error ?? '')
    }
  } catch {}
  return { status, code, network: false }
}
