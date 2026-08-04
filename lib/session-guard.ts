/**
 * Session-integrity guard. Listens to Supabase auth events and redirects to
 * the login screen when the token dies (revoked, expired past refresh, signed
 * out elsewhere). Pure side-effect hook — mounted once at the guard layer.
 */

import { useEffect, useRef } from 'react'
import { useRouter, useSegments } from 'expo-router'
import { getSupabase } from '@/lib/supabase/client'

const AUTH_ROOT_SEGMENT = '(auth)'

export function useSessionGuard() {
  const router = useRouter()
  const segments = useSegments()
  const initialised = useRef(false)

  useEffect(() => {
    const supabase = getSupabase()
    const { data: sub } = supabase.auth.onAuthStateChange((event, _session) => {
      const inAuthArea = segments[0] === AUTH_ROOT_SEGMENT
      if (!initialised.current) {
        initialised.current = true
        return
      }
      if (event === 'SIGNED_OUT' && !inAuthArea) {
        router.replace('/(auth)/login' as any)
      }
    })
    return () => {
      try {
        sub.subscription.unsubscribe()
      } catch {}
    }
  }, [router, segments])
}

export function isSessionExpiredError(err: any): boolean {
  if (!err) return false
  const msg = String(err?.message ?? '').toLowerCase()
  const status = err?.status ?? err?.code
  return (
    msg.includes('jwt expired') ||
    msg.includes('invalid jwt') ||
    msg.includes('refresh token') ||
    status === 401
  )
}
