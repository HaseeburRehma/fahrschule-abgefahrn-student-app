/**
 * Stale-response guard for screens that (re)fetch on focus / pull-to-refresh.
 *
 *   const guard = useRequestGuard()
 *   const load = async () => {
 *     const req = guard.begin()
 *     const data = await fetch…()
 *     if (!guard.isCurrent(req)) return   // unmounted or a newer request started
 *     setState(data)
 *   }
 */

import { useEffect, useMemo, useRef } from 'react'

export interface RequestGuard {
  /** Starts a request; returns its token. */
  begin: () => number
  /** True while the component is mounted and `token` is the latest request. */
  isCurrent: (token: number) => boolean
  /** True while the component is mounted. */
  isMounted: () => boolean
}

export function useRequestGuard(): RequestGuard {
  const seq = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  return useMemo(
    () => ({
      begin: () => ++seq.current,
      isCurrent: (token: number) => mounted.current && token === seq.current,
      isMounted: () => mounted.current,
    }),
    [],
  )
}
