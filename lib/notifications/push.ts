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
import { useRouter } from 'expo-router'
import Constants from 'expo-constants'
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

async function ensurePermission(): Promise<boolean> {
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

async function getExpoPushToken(): Promise<string | null> {
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
  if (type === 'schedule') router.push('/(tabs)/schedule')
  else if (type === 'theory') router.push('/(tabs)/theory')
  else router.push('/(tabs)/notifications')
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
      const ok = await ensurePermission()
      if (!ok || cancelled) return
      await ensureAndroidChannel()
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

  // Handle taps (foreground + cold start).
  useEffect(() => {
    if (Platform.OS === 'web') return
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      routeForNotification(
        resp.notification.request.content.data as any,
        router,
      )
    })
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (resp)
        routeForNotification(
          resp.notification.request.content.data as any,
          router,
        )
    })
    return () => sub.remove()
  }, [router])
}
