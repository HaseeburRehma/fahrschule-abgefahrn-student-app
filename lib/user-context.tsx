/**
 * UserContext — single source of truth for session + profile + role.
 *
 * Design mirrors LokShift's: split `loading` (session check done) from
 * `profileLoading` (profile fetch done) so the UI can unblock immediately.
 * `ready` gates the AuthGuard so we never flash the wrong screen.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { getSupabase } from '@/lib/supabase/client'
import { withTimeout } from '@/lib/async'
import { normalizeRole, isAdmin as roleIsAdmin } from '@/lib/rbac/permissions'
import type { Profile, UserRole } from '@/lib/types'

interface UserContextValue {
  session: any | null
  loading: boolean
  profile: Profile | null
  profileLoading: boolean
  role: UserRole | null
  isAdmin: boolean
  isStudent: boolean
  /** true once the session AND (if signed in) the profile decision are known */
  ready: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

const profileCacheKey = (uid: string) => `abgefahrn.profile.${uid}`
/** Never keep the splash up longer than this when the network hangs. */
const SESSION_TIMEOUT_MS = 10_000
const PROFILE_TIMEOUT_MS = 12_000

function clearProfileCache(uid: string | null | undefined) {
  if (uid) AsyncStorage.removeItem(profileCacheKey(uid)).catch(() => {})
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileValidated, setProfileValidated] = useState(false)

  // Guards against stale writes across fast login/logout cycles.
  const activeUserId = useRef<string | null>(null)
  // Monotonic id of the latest profile request (older responses are ignored).
  const profileReq = useRef(0)
  /** uid whose profile came from the network this session (cache hydrate is then skipped) */
  const freshFor = useRef<string | null>(null)

  const loadProfile = useCallback(async (uid: string) => {
    const req = ++profileReq.current
    const current = () => activeUserId.current === uid && profileReq.current === req
    setProfileLoading(true)
    // Instant hydrate from cache (authoritative refresh follows). A cache hit is
    // enough to unblock the UI — the network result replaces it moments later.
    // Skipped on refreshes: the cache would briefly show pre-edit values.
    try {
      const cached = freshFor.current === uid ? null : await AsyncStorage.getItem(profileCacheKey(uid))
      if (cached && current()) {
        const parsed = JSON.parse(cached) as Profile | null
        if (parsed && parsed.id === uid) {
          setProfile(parsed)
          setProfileValidated(true)
        }
      }
    } catch {}

    try {
      const supabase = getSupabase()
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        PROFILE_TIMEOUT_MS,
      )

      if (!current()) return // switched users / newer request mid-flight

      if (error) throw error

      const p = (data ?? null) as Profile | null
      if (!p) {
        // No profile row (deleted / not provisioned): drop any stale cache.
        clearProfileCache(uid)
        setProfile(null)
        return
      }
      // Inactive accounts are force-signed-out even with a valid token.
      if (p.is_active === false) {
        clearProfileCache(uid)
        setProfile(null)
        await signOutEverywhere()
        return
      }
      setProfile(p)
      freshFor.current = uid
      AsyncStorage.setItem(profileCacheKey(uid), JSON.stringify(p)).catch(() => {})
    } catch {
      // Network / timeout: keep any cached profile; leave decision to next refresh.
    } finally {
      if (current()) {
        setProfileLoading(false)
        setProfileValidated(true)
      }
    }
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    let mounted = true

    // supabase-js runs auth callbacks while holding its auth lock; calling the client
    // (profile query → getSession) synchronously from inside one can deadlock.
    const defer = (fn: () => void) => setTimeout(fn, 0)

    /** Single place that reacts to a (possibly unchanged) session. */
    const apply = (s: any | null, event: string) => {
      if (!mounted) return
      const uid: string | null = s?.user?.id ?? null
      const prev = activeUserId.current
      setSession(s)
      setLoading(false)
      if (uid !== prev) {
        activeUserId.current = uid
        freshFor.current = null
        // Signed out (explicitly, expired refresh token, revoked …) → forget the cached profile.
        if (prev && !uid) clearProfileCache(prev)
        setProfile(null)
        setProfileValidated(false)
        if (uid) defer(() => loadProfile(uid))
        else setProfileLoading(false)
      } else if (uid && (event === 'USER_UPDATED' || event === 'SIGNED_IN')) {
        // Same user — refresh quietly (token refreshes don't touch the profile).
        defer(() => loadProfile(uid))
      }
    }

    withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS)
      .then(({ data }: any) => apply(data?.session ?? null, 'INITIAL_SESSION'))
      .catch(() => {
        // Storage/refresh failure or hang: fall back to signed-out so the app never
        // sticks on the splash. A late INITIAL_SESSION/SIGNED_IN event still signs in.
        if (mounted && activeUserId.current === null) {
          setSession(null)
          setLoading(false)
        }
      })

    const { data: sub } = supabase.auth.onAuthStateChange((event, s: any) => apply(s ?? null, event))

    return () => {
      mounted = false
      try {
        sub.subscription.unsubscribe()
      } catch {}
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    const uid = activeUserId.current
    if (uid) await loadProfile(uid)
  }, [loadProfile])

  const signOut = useCallback(async () => {
    const uid = activeUserId.current
    clearProfileCache(uid)
    await signOutEverywhere()
    setProfile(null)
    setProfileValidated(false)
  }, [])

  const role = profile ? normalizeRole(profile.role) : null
  const ready = !loading && (!session || profileValidated)

  const value = useMemo<UserContextValue>(
    () => ({
      session,
      loading,
      profile,
      profileLoading,
      role,
      isAdmin: roleIsAdmin(role),
      isStudent: role === 'student',
      ready,
      refreshProfile,
      signOut,
    }),
    [session, loading, profile, profileLoading, role, ready, refreshProfile, signOut],
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

/**
 * supabase-js keeps the local session when the sign-out request fails (offline,
 * timeout): fall back to a local-only sign-out so the user is never stuck signed in.
 */
async function signOutEverywhere() {
  const auth = getSupabase().auth
  try {
    const { error } = await withTimeout(auth.signOut(), 8000)
    if (!error) return
  } catch {}
  try {
    await auth.signOut({ scope: 'local' })
  } catch {}
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within <UserProvider>')
  return ctx
}
