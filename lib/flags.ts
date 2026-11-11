/**
 * Feature flags / kill switches.
 *
 * Stored server-side in app_settings ('feature.<name>' = 'on' | 'off'), read
 * through the public feature_flags() RPC and switched by admins in
 * Administration → Anmeldecode & Schalter. Lets the school turn a feature off
 * (e.g. invite e-mails while the mail domain has a problem) without an app
 * release. The edge functions enforce the same flags on the server.
 *
 * Cached for 60 s in memory; setFeatureFlag() invalidates the cache.
 */

import { useCallback, useEffect, useState } from 'react'

import { getSupabase } from '@/lib/supabase/client'

export const FEATURE_FLAGS = ['invite_emails', 'student_import', 'performance_dashboard'] as const
export type FeatureFlag = (typeof FEATURE_FLAGS)[number]
export type Flags = Record<FeatureFlag, boolean>

/** Everything on — also the fallback while the backend has no flags yet. */
export const DEFAULT_FLAGS: Flags = { invite_emails: true, student_import: true, performance_dashboard: true }

const TTL_MS = 60_000
let cache: { at: number; flags: Flags } | null = null
let inflight: Promise<Flags> | null = null

export function parseFlags(rows: { key: string; enabled: boolean }[] | null | undefined): Flags {
  const out: Flags = { ...DEFAULT_FLAGS }
  for (const r of rows ?? []) if ((FEATURE_FLAGS as readonly string[]).includes(r.key)) out[r.key as FeatureFlag] = !!r.enabled
  return out
}

export async function fetchFeatureFlags(force = false, now = Date.now()): Promise<Flags> {
  if (!force && cache && now - cache.at < TTL_MS) return cache.flags
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const { data, error } = await getSupabase().rpc('feature_flags')
      const flags = error ? { ...DEFAULT_FLAGS } : parseFlags(data as any)
      if (!error) cache = { at: Date.now(), flags }
      return flags
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export function invalidateFeatureFlags() {
  cache = null
}

/** Admin only (RLS on app_settings). */
export async function setFeatureFlag(name: FeatureFlag, enabled: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('app_settings')
    .upsert({ key: `feature.${name}`, value: enabled ? 'on' : 'off' })
  invalidateFeatureFlags()
  if (error) throw error
}

export function useFeatureFlags(): { flags: Flags; reload: () => Promise<void> } {
  const [flags, setFlags] = useState<Flags>(cache?.flags ?? DEFAULT_FLAGS)
  const reload = useCallback(async () => {
    setFlags(await fetchFeatureFlags(true))
  }, [])
  useEffect(() => {
    let alive = true
    fetchFeatureFlags()
      .then((f) => alive && setFlags(f))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return { flags, reload }
}
