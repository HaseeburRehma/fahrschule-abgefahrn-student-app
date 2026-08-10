/**
 * Local class reminders — schedules an on-device notification a couple of hours
 * before each upcoming theory class the student is enrolled in. No server / push
 * token needed (works before the native push pipeline is live). Web is a no-op.
 *
 * Call `scheduleReminders(items)` whenever the schedule loads; it clears the
 * previously scheduled set first, so re-running never duplicates.
 */

import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'

export interface ReminderItem {
  id: string
  fireAt: Date
  title: string
  body: string
}

export async function scheduleReminders(items: ReminderItem[]): Promise<void> {
  if (Platform.OS === 'web') return
  if (!Device.isDevice) return
  try {
    const perm = await Notifications.getPermissionsAsync()
    if (!perm.granted && perm.status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync()
      if (!req.granted && req.status !== 'granted') return
    }
    // Clear our previously scheduled reminders so re-runs don't duplicate.
    await Notifications.cancelAllScheduledNotificationsAsync()

    const now = Date.now()
    for (const it of items) {
      if (it.fireAt.getTime() <= now) continue
      await Notifications.scheduleNotificationAsync({
        content: {
          title: it.title,
          body: it.body,
          data: { type: 'schedule', classId: it.id },
        },
        trigger: { date: it.fireAt } as any,
      })
    }
  } catch {
    // best-effort; a failed reminder must never break the screen
  }
}

/** Hours before a class to fire the reminder. */
export const REMINDER_LEAD_HOURS = 2
