import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'

import { useUser } from '@/lib/user-context'
import { useRequestGuard } from '@/lib/use-request-guard'
import { fetchMyQuizAttempts } from './api'
import type { QuizAttempt } from './gamification'

/**
 * The signed-in student's quiz rounds, refetched on focus.
 * `unavailable` is true when the quiz tables aren't deployed yet (migration
 * 20261026000001 not applied) — screens then show zero progress instead of an error.
 */
export function useQuizAttempts() {
  const { session } = useUser()
  const uid: string | null = session?.user?.id ?? null
  const guard = useRequestGuard()
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  const load = useCallback(async () => {
    const req = guard.begin()
    if (!uid) {
      setLoading(false)
      return
    }
    try {
      const rows = await fetchMyQuizAttempts(uid)
      if (!guard.isCurrent(req)) return
      setAttempts(rows)
      setError(false)
      setUnavailable(false)
    } catch (e: any) {
      if (!guard.isCurrent(req)) return
      // 42P01 = undefined_table, PGRST205 = table not in schema cache
      if (e?.code === '42P01' || e?.code === 'PGRST205') setUnavailable(true)
      else setError(true)
    } finally {
      if (guard.isCurrent(req)) setLoading(false)
    }
  }, [uid, guard])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  return { attempts, loading, error, unavailable, reload: load }
}
