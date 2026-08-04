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

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileValidated, setProfileValidated] = useState(false)

  // Guards against stale writes across fast login/logout cycles.
  const activeUserId = useRef<string | null>(null)

  const loadProfile = useCallback(async (uid: string) => {
    setProfileLoading(true)
    // Instant hydrate from cache (authoritative refresh follows).
    try {
      const cached = await AsyncStorage.getItem(profileCacheKey(uid))
      if (cached && activeUserId.current === uid) {
        setProfile(JSON.parse(cached))
      }
    } catch {}

    try {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single()

      if (activeUserId.current !== uid) return // switched users mid-flight

      if (error) throw error

      const p = data as Profile
      // Inactive accounts are force-signed-out even with a valid token.
      if (p && p.is_active === false) {
        await getSupabase().auth.signOut()
        return
      }
      setProfile(p)
      AsyncStorage.setItem(profileCacheKey(uid), JSON.stringify(p)).catch(() => {})
    } catch {
      // Keep any cached profile; leave decision to next refresh.
    } finally {
      if (activeUserId.current === uid) {
        setProfileLoading(false)
        setProfileValidated(true)
      }
    }
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    let mounted = true

    supabase.auth.getSession().then(({ data }: any) => {
      if (!mounted) return
      const s = data?.session ?? null
      setSession(s)
      setLoading(false)
      const uid = s?.user?.id ?? null
      activeUserId.current = uid
      if (uid) loadProfile(uid)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s: any) => {
      const uid = s?.user?.id ?? null
      setSession(s)
      activeUserId.current = uid
      if (uid) {
        setProfileValidated(false)
        loadProfile(uid)
      } else {
        setProfile(null)
        setProfileValidated(false)
        setProfileLoading(false)
      }
    })

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
    try {
      await getSupabase().auth.signOut()
    } catch {}
    if (uid) AsyncStorage.removeItem(profileCacheKey(uid)).catch(() => {})
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

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within <UserProvider>')
  return ctx
}
