import { Linking } from 'react-native'
import type { TheoryClass } from '@/lib/types'

// Date → "YYYYMMDDTHHMMSSZ" (Google Calendar / iCal UTC format).
function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Add a class to the user's calendar via a Google Calendar template URL —
 * opens Google Calendar on web and the calendar/browser on native, no extra
 * permissions or native modules needed.
 */
export function addToCalendar(c: TheoryClass, title: string): void {
  const start = new Date(c.starts_at)
  const end = c.ends_at ? new Date(c.ends_at) : new Date(start.getTime() + 60 * 60_000)
  const url =
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${stamp(start)}/${stamp(end)}` +
    (c.location ? `&location=${encodeURIComponent(c.location)}` : '') +
    (c.notes ? `&details=${encodeURIComponent(c.notes)}` : '')
  Linking.openURL(url).catch(() => {})
}
