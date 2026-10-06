/**
 * Session-integrity guard. Listens to Supabase auth events and redirects to
 * the login screen when the token dies (revoked, expired past refresh, signed
 * out elsewhere). Pure side-effect hook — mounted once at the guard layer.
 */

import { useEffect, useRef } from 'react'
import { useRouter, useSegments } from 'expo-router'
import { getSupabase } from '@/lib/supabase/client'
import { PUBLIC_ROUTES } from '@/lib/auth/flow'

const AUTH_ROOT_SEGMENT = '(auth)'

export function useSessionGuard() {
  const router = useRouter()
  const segments = useSegments() as string[]
  // Read the current route through a ref so the auth listener is registered once,
  // not re-subscribed on every navigation.
  const segRef = useRef(segments)
  segRef.current = segments

  useEffect(() => {
    const supabase = getSupabase()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return
      const first = segRef.current[0] ?? ''
      if (first === AUTH_ROOT_SEGMENT || PUBLIC_ROUTES.includes(first)) return
      // Defer: never navigate from inside supabase's auth callback (it holds the auth lock).
      setTimeout(() => router.replace('/(auth)/login' as any), 0)
    })
    return () => {
      try {
        sub.subscription.unsubscribe()
      } catch {}
    }
  }, [router])
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
