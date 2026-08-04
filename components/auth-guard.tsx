/**
 * AuthGuard — keeps the navigator mounted and redirects via an effect.
 *   - not signed in            → /(auth)/login
 *   - signed in but on /(auth) → /(tabs)/home
 *   - signed in at root '/'    → /(tabs)/home
 *
 * The <Stack> (children) must stay mounted for router.replace to resolve, so we
 * gate only on `!ready` (a transient spinner on cold start), never permanently.
 */

import React, { useEffect } from 'react'
import { useRouter, useSegments } from 'expo-router'

import { useUser } from '@/lib/user-context'
import { Loader } from '@/components/ui'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, ready } = useUser()
  const router = useRouter()
  const segments = useSegments()

  const inAuthArea = segments[0] === '(auth)'
  const atRoot = (segments as string[]).length === 0

  useEffect(() => {
    if (!ready) return
    if (!session) {
      if (!inAuthArea) router.replace('/(auth)/login' as any)
    } else if (inAuthArea || atRoot) {
      router.replace('/(tabs)/home' as any)
    }
  }, [ready, session, inAuthArea, atRoot, router])

  if (!ready) return <Loader />
  return <>{children}</>
}
