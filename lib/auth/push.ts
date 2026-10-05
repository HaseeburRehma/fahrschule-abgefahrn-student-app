/**
 * Push opt-in for the "Push erlauben" screen.
 *
 * PushRegistrar (lib/notifications/push.ts) registers the token once per sign-in; if the
 * user only grants permission later on this screen, its effect does not re-run — so after
 * a grant we store the token here directly (same columns, best-effort).
 */

import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'

import { getSupabase } from '@/lib/supabase/client'

export async function hasPushPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return true
  try {
    const p = await Notifications.getPermissionsAsync()
    return p.granted || p.status === 'granted'
  } catch {
    return false
  }
}

/** Asks the OS for permission; returns true when granted. Never throws. */
export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  try {
    const current = await Notifications.getPermissionsAsync()
    if (current.granted || current.status === 'granted') return true
    const req = await Notifications.requestPermissionsAsync()
    return req.granted || req.status === 'granted'
  } catch {
    return false
  }
}

/** Fetches the Expo push token and stores it on the profile. Best-effort, never throws. */
export async function registerPushToken(userId: string | null | undefined): Promise<void> {
  if (Platform.OS === 'web' || !userId || !Device.isDevice) return
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#22C55E',
      })
    }
    const projectId =
      (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId
    if (!projectId) return
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    if (!token) return
    await getSupabase()
      .from('profiles')
      .update({
        push_token: token,
        push_token_platform: Platform.OS,
        push_token_updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
  } catch {
    // realtime feed still works without a push token
  }
}

const PROMPT_KEY = 'abgefahrn.pushPromptShown'

/** Remember that the "Push erlauben" screen was shown (so Home doesn't show it again). */
export async function markPushPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(PROMPT_KEY, '1')
  } catch {}
}

/**
 * True when a signed-in user on a real device has never been asked for push
 * permission and hasn't seen our "Push erlauben" screen yet (e.g. existing
 * students who log in instead of signing up).
 */
export async function shouldOfferPushPrompt(): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) return false
  try {
    if ((await AsyncStorage.getItem(PROMPT_KEY)) === '1') return false
    const p = await Notifications.getPermissionsAsync()
    return p.status === 'undetermined' && p.canAskAgain !== false
  } catch {
    return false
  }
}
