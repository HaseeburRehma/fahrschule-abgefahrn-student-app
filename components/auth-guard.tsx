/**
 * AuthGuard — keeps the navigator mounted and redirects via an effect.
 *   - not signed in            → /(auth)/welcome (first launch) or /(auth)/login
 *   - signed in but on /(auth) → post-auth route (e.g. /account-created) or /(tabs)/home
 *   - signed in at root '/'    → /(tabs)/home
 *   - recovery link            → /reset-password (signed in by the link)
 *
 * The <Stack> (children) must stay mounted for router.replace to resolve, so we
 * gate only on `!ready` (the Figma splash on cold start), never permanently.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useRouter, useSegments } from 'expo-router'

import { useUser } from '@/lib/user-context'
import { getSupabase } from '@/lib/supabase/client'
import { SplashView } from '@/components/splash'
import {
  PUBLIC_ROUTES,
  SIGNED_IN_AUTH_ROUTES,
  hasSeenOnboarding,
  takePostAuthRoute,
} from '@/lib/auth/flow'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, ready } = useUser()
  const router = useRouter()
  const segments = useSegments() as string[]
  const [onboarded, setOnboarded] = useState<boolean | null>(null)
  // After the first resolution keep the navigator mounted: `ready` briefly goes
  // false while the profile loads after sign-in, which must not remount screens.
  const booted = useRef(false)

  useEffect(() => {
    hasSeenOnboarding().then(setOnboarded)
  }, [session])

  // Password-recovery links sign the user in; send them to set a new password.
  useEffect(() => {
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') router.replace('/reset-password' as any)
    })
    return () => data.subscription.unsubscribe()
  }, [router])

  const inAuthArea = segments[0] === '(auth)'
  const atRoot = segments.length === 0
  const first = segments[0] ?? ''

  useEffect(() => {
    if (!ready || onboarded === null) return
    if (!session) {
      if (!inAuthArea && !PUBLIC_ROUTES.includes(first)) {
        router.replace((onboarded ? '/(auth)/login' : '/(auth)/welcome') as any)
      }
    } else if (inAuthArea || atRoot) {
      router.replace((takePostAuthRoute() ?? '/(tabs)/home') as any)
    } else if (SIGNED_IN_AUTH_ROUTES.includes(first)) {
      // allowed
    }
  }, [ready, session, inAuthArea, atRoot, first, onboarded, router])

  if (ready && onboarded !== null) booted.current = true
  if (!booted.current) return <SplashView />
  return <>{children}</>
}
