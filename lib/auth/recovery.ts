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
