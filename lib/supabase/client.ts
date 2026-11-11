/**
 * Supabase client for React Native + Web.
 *
 *   1. Session storage uses AsyncStorage (app sandbox on native,
 *      localStorage on web).
 *   2. url-polyfill loads before supabase-js — RN's stock URL is
 *      missing pieces the Supabase auth code expects.
 *   3. detectSessionInUrl is on for web only (password-recovery links);
 *      native handles recovery links in app/reset-password.tsx.
 *   4. Every request times out (fetchWithTimeout) and function calls carry
 *      an x-request-id for tracing.
 *   Planned with the next native build: expo-secure-store (Keychain /
 *   Keystore) instead of AsyncStorage for the session on phones.
 *
 * The URL + anon key come from EXPO_PUBLIC_* env vars (see .env.example).
 */

import 'react-native-url-polyfill/auto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import Constants from 'expo-constants'

const SupabaseStorage = AsyncStorage

const supabaseUrl =
  (Constants.expoConfig?.extra as any)?.supabaseUrl ??
  process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey =
  (Constants.expoConfig?.extra as any)?.supabaseAnonKey ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in the values.',
  )
}

/**
 * Permissive auth shape covering the methods our screens call. The shipped
 * supabase-js types only partially surface the auth method bag, which causes
 * TS2339 false positives; casting at the boundary keeps tsc happy.
 */
type AuthLike = {
  signInWithOtp: (params: { email: string; options?: any }) => Promise<any>
  verifyOtp: (params: {
    email: string
    token: string
    type: string
  }) => Promise<any>
  signInWithPassword: (params: { email: string; password: string }) => Promise<any>
  resetPasswordForEmail: (email: string, options?: { redirectTo?: string }) => Promise<any>
  setSession: (params: { access_token: string; refresh_token: string }) => Promise<any>
  exchangeCodeForSession: (code: string) => Promise<any>
  signOut: (opts?: { scope?: 'global' | 'local' | 'others' }) => Promise<any>
  updateUser: (attrs: any) => Promise<any>
  getUser: () => Promise<any>
  getSession: () => Promise<any>
  onAuthStateChange: (
    cb: (event: string, session: any) => void,
  ) => { data: { subscription: { unsubscribe: () => void } } }
  admin?: any
}

export type AppSupabase = Omit<SupabaseClient, 'auth'> & { auth: AuthLike }

let cached: SupabaseClient | null = null

/** Per-request timeouts: storage uploads/downloads get longer than API calls. */
const API_TIMEOUT_MS = 30_000
const STORAGE_TIMEOUT_MS = 120_000

function newRequestId(): string {
  const r = () => Math.random().toString(16).slice(2, 10)
  return `app-${Date.now().toString(36)}-${r()}${r()}`
}

/**
 * fetch used by supabase-js: aborts hanging requests (so the UI never spins
 * forever on a dead connection) and tags each call with an x-request-id that
 * the edge functions log — one id to follow a request across app and server.
 */
export const fetchWithTimeout: typeof fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
  const ms = url.includes('/storage/v1/') ? STORAGE_TIMEOUT_MS : API_TIMEOUT_MS
  const ctrl = new AbortController()
  const outer = init.signal
  if (outer) {
    if (outer.aborted) ctrl.abort()
    else outer.addEventListener('abort', () => ctrl.abort(), { once: true })
  }
  const timer = setTimeout(() => ctrl.abort(), ms)
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined))
  if (url.includes('/functions/v1/') && !headers.has('x-request-id')) headers.set('x-request-id', newRequestId())
  return fetch(input, { ...init, headers, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

export function getSupabase(): AppSupabase {
  if (cached) return cached as unknown as AppSupabase
  cached = createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: {
      storage: SupabaseStorage as any,
      autoRefreshToken: true,
      persistSession: true,
      // Web: parse password-recovery links (#access_token=…&type=recovery).
      detectSessionInUrl: Platform.OS === 'web',
    },
    global: { fetch: fetchWithTimeout },
  })
  return cached as unknown as AppSupabase
}
