/**
 * Push-token registration + tap routing (native only).
 *
 * On web this is a no-op (browsers use the in-app realtime feed instead).
 * On a real device it: configures the foreground handler, requests permission,
 * ensures an Android channel, gets the Expo push token, and stores it on the
 * user's profile row. The `push-dispatch` Edge Function reads that token when a
 * notification is inserted and POSTs to https://exp.host/--/api/v2/push/send.
 */

import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'

import { getSupabase } from '@/lib/supabase/client'
import { useUser } from '@/lib/user-context'

function configureForegroundHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      // SDK 50+ field names (kept alongside the legacy ones above).
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (current.granted || current.status === 'granted') return true
  const req = await Notifications.requestPermissionsAsync()
  return req.granted || req.status === 'granted'
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#22C55E',
  })
}

/**
 * Remote (server) push is available: real device, not web, and not Expo Go on
 * Android (removed from Expo Go in SDK 53 — local notifications still work there).
 */
export function remotePushSupported(): boolean {
  if (Platform.OS === 'web' || !Device.isDevice) return false
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false
  return true
}

export async function getExpoPushToken(): Promise<string | null> {
  if (!remotePushSupported()) return null
  const projectId =
    (Constants.expoConfig?.extra as any)?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId
  if (!projectId) return null // EAS project id not set yet
  try {
    const res = await Notifications.getExpoPushTokenAsync({ projectId })
    return res.data ?? null
  } catch {
    return null
  }
}

/**
 * Route a tapped notification to the right screen based on its `data.type`.
 * The dispatcher copies notifications.data into the push payload.
 */
function routeForNotification(
  data: Record<string, any> | undefined,
  router: ReturnType<typeof useRouter>,
) {
  const type = data?.type
  if (typeof data?.appointment_id === 'string' && data.appointment_id) router.push(`/appointment/${data.appointment_id}` as any)
  else if (type === 'schedule') router.push('/(tabs)/schedule')
  else if (type === 'theory') router.push('/(tabs)/theory')
  else if (type === 'exam') router.push('/exams' as any)
  else router.push('/notifications' as any)
}

export function usePushRegistration(): void {
  const { session } = useUser()
  const router = useRouter()
  const userId: string | null = session?.user?.id ?? null
  const lastToken = useRef<string | null>(null)

  // Register token when signed in on a real device.
  useEffect(() => {
    if (Platform.OS === 'web') return
    if (!userId) return
    let cancelled = false

    ;(async () => {
      configureForegroundHandler()
      if (!Device.isDevice) return // simulators can't get push tokens
      if (!(await getPushEnabled())) return // user switched push off (Profil)
      // Never trigger the OS prompt here — the "Push erlauben" screen owns it.
      // Only register when permission was already granted.
      const perm = await Notifications.getPermissionsAsync().catch(() => null)
      if (!perm || !(perm.granted || perm.status === 'granted') || cancelled) return
      await ensureAndroidChannel().catch(() => {})
      const token = await getExpoPushToken()
      if (!token || cancelled || token === lastToken.current) return
      lastToken.current = token
      try {
        await getSupabase()
          .from('profiles')
          .update({
            push_token: token,
            push_token_platform: Platform.OS,
            push_token_updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
      } catch {
        // best-effort; realtime feed still works without a push token
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  // Handle taps (foreground + cold start). Each response is routed once — the
  // cold-start response would otherwise re-route every time this effect re-runs.
  const handled = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (Platform.OS === 'web') return
    let alive = true
    const handle = (resp: Notifications.NotificationResponse | null) => {
      if (!alive || !resp) return
      const id = resp.notification.request.identifier
      if (id && handled.current.has(id)) return
      if (id) handled.current.add(id)
      routeForNotification(resp.notification.request.content.data as any, router)
    }
    const sub = Notifications.addNotificationResponseReceivedListener(handle)
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {})
    return () => {
      alive = false
      sub.remove()
    }
  }, [router])
}

/* ---------------------------------------------------------------- preference */

const PUSH_PREF_KEY = 'abgefahrn.pref.push'

/** User preference (Profil → Push-Benachrichtigungen). Defaults to on. */
export async function getPushEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PUSH_PREF_KEY)) !== '0'
  } catch {
    return true
  }
}

/**
 * Switch remote push on/off. Off clears the stored token so the dispatcher
 * stops sending; on re-requests permission and stores a fresh token.
 * Returns the effective state (false if permission was denied).
 */
export async function setPushEnabled(userId: string | null, enabled: boolean): Promise<boolean> {
  try {
    await AsyncStorage.setItem(PUSH_PREF_KEY, enabled ? '1' : '0')
  } catch {}
  if (Platform.OS === 'web' || !userId) return enabled
  const supabase = getSupabase()
  if (!enabled) {
    try {
      await supabase.from('profiles').update({ push_token: null }).eq('id', userId)
    } catch {}
    return false
  }
  if (!Device.isDevice) return true
  const ok = await ensurePermission().catch(() => false)
  if (!ok) {
    try {
      await AsyncStorage.setItem(PUSH_PREF_KEY, '0')
    } catch {}
    return false
  }
  await ensureAndroidChannel().catch(() => {})
  const token = await getExpoPushToken()
  if (token) {
    try {
      await supabase
        .from('profiles')
        .update({
          push_token: token,
          push_token_platform: Platform.OS,
          push_token_updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
    } catch {}
  }
  return true
}
