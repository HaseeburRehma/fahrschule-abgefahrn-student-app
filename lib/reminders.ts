/**
 * Local on-device notifications — class/appointment reminders and the daily
 * pre-exam motivation pushes. No server / push token needed; web is a no-op.
 *
 * Each caller passes a `category` so its set can be rescheduled independently
 * (we store the scheduled ids per category and cancel only those — so the
 * schedule screen never wipes the exam motivation pushes and vice versa).
 */

import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'

export interface ReminderItem {
  id: string
  fireAt: Date
  title: string
  body: string
}

const storeKey = (category: string) => `abgefahrn.sched.${category}`

async function cancelStored(category: string) {
  try {
    const raw = await AsyncStorage.getItem(storeKey(category))
    if (raw) {
      for (const id of JSON.parse(raw) as string[]) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
      }
    }
  } catch {}
}

/* ---------------------------------------------------------------- preference */

const PREF_KEY = 'abgefahrn.pref.reminders'
const CATEGORIES = ['reminders', 'motivation']

/** User preference (Profil → Erinnerungen). Defaults to on. */
export async function getRemindersEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) !== '0'
  } catch {
    return true
  }
}

/** Turning reminders off cancels everything already scheduled; screens
 * re-schedule on their next load once it is switched back on. */
export async function setRemindersEnabled(v: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_KEY, v ? '1' : '0')
  } catch {}
  if (!v && Platform.OS !== 'web') {
    for (const c of CATEGORIES) await cancelStored(c)
  }
}

export async function scheduleReminders(
  items: ReminderItem[],
  category = 'reminders',
): Promise<void> {
  if (Platform.OS === 'web') return
  if (!Device.isDevice) return
  if (items.length && !(await getRemindersEnabled())) {
    await cancelStored(category)
    return
  }
  try {
    const perm = await Notifications.getPermissionsAsync()
    if (!perm.granted && perm.status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync()
      if (!req.granted && req.status !== 'granted') return
    }
    await cancelStored(category)
    const ids: string[] = []
    const now = Date.now()
    for (const it of items) {
      if (it.fireAt.getTime() <= now) continue
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: it.title,
          body: it.body,
          data: { type: category === 'motivation' ? 'exam' : 'schedule', refId: it.id },
        },
        trigger: { date: it.fireAt } as any,
      })
      ids.push(id)
    }
    await AsyncStorage.setItem(storeKey(category), JSON.stringify(ids))
  } catch {
    // best-effort; a failed reminder must never break the screen
  }
}

/** Hours before a class/appointment to fire the reminder. */
export const REMINDER_LEAD_HOURS = 2
