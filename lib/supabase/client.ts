/**
 * Supabase client for React Native + Web.
 *
 *   1. Session storage uses AsyncStorage (app sandbox on native,
 *      localStorage on web).
 *   2. url-polyfill loads before supabase-js — RN's stock URL is
 *      missing pieces the Supabase auth code expects.
 *   3. detectSessionInUrl is disabled (we use OTP, not a browser
 *      redirect callback flow).
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
  signOut: () => Promise<any>
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

export function getSupabase(): AppSupabase {
  if (cached) return cached as unknown as AppSupabase
  cached = createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: {
      storage: SupabaseStorage as any,
      autoRefreshToken: true,
      persistSession: true,
      // Web: parse password-recovery links (#access_token…      detectSessionInUrl: false,type=recovery).
      detectSessionInUrl: Platform.OS === 'web',
    },
  })
  return cached as unknown as AppSupabase
}
