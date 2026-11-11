/**
 * Password-recovery helpers (forgot → link-sent → reset-password).
 */

import { Platform } from 'react-native'
import * as Linking from 'expo-linking'

import { getSupabase } from '@/lib/supabase/client'

/**
 * Where the recovery link should land: web → `${origin}/reset-password`, native →
 * abgefahrn://reset-password. Must be allow-listed in Supabase → Auth → URL configuration.
 */
export function recoveryRedirect(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/reset-password`
  return Linking.createURL('/reset-password')
}

/**
 * Set when Supabase fires PASSWORD_RECOVERY (the user really came from a
 * recovery link). The reset screen only accepts an already-existing session
 * when this happened recently — otherwise anyone holding an unlocked, signed-in
 * device could open /reset-password and change the password without knowing it.
 */
let recoveryEventAt = 0
const RECOVERY_WINDOW_MS = 15 * 60_000

export function markRecoveryEvent(now = Date.now()) {
  recoveryEventAt = now
}

export function recoveryEventFresh(now = Date.now()): boolean {
  return recoveryEventAt > 0 && now - recoveryEventAt < RECOVERY_WINDOW_MS
}

export function clearRecoveryEvent() {
  recoveryEventAt = 0
}

// Web: supabase-js consumes the #access_token=…&type=recovery fragment when it
// initialises (possibly before any listener is attached), so remember at load
// time that this page was opened from a recovery link.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const p = parseAuthParams(window.location.href)
  if (p.type === 'recovery' || ((p.access_token || p.code) && window.location.pathname.endsWith('/reset-password'))) markRecoveryEvent()
}

export async function sendRecoveryMail(email: string) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: recoveryRedirect() })
  if (error) throw error
}

/** Reads auth params from both the query (`?code=`) and the fragment (`#access_token=…`). */
export function parseAuthParams(url: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!url) return out
  const take = (s: string) => {
    for (const part of s.split('&')) {
      if (!part) continue
      const i = part.indexOf('=')
      const k = decodeURIComponent(i === -1 ? part : part.slice(0, i))
      const v = i === -1 ? '' : decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '))
      if (k) out[k] = v
    }
  }
  const hashAt = url.indexOf('#')
  const qAt = url.indexOf('?')
  if (qAt !== -1) take(url.slice(qAt + 1, hashAt !== -1 && hashAt > qAt ? hashAt : undefined))
  if (hashAt !== -1) take(url.slice(hashAt + 1))
  return out
}
