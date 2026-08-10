import { Linking } from 'react-native'

// Date → "YYYYMMDDTHHMMSSZ" (Google Calendar / iCal UTC format).
function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

interface CalEvent {
  starts_at: string
  ends_at?: string | null
  location?: string | null
  notes?: string | null
}

/**
 * Add an event (theory class or personal appointment) to the user's calendar
 * via a Google Calendar template URL — opens Google Calendar on web and the
 * calendar/browser on native, no extra permissions or native modules needed.
 */
export function addToCalendar(ev: CalEvent, title: string): void {
  const start = new Date(ev.starts_at)
  const end = ev.ends_at
    ? new Date(ev.ends_at)
    : new Date(start.getTime() + 60 * 60_000)
  const url =
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${stamp(start)}/${stamp(end)}` +
    (ev.location ? `&location=${encodeURIComponent(ev.location)}` : '') +
    (ev.notes ? `&details=${encodeURIComponent(ev.notes)}` : '')
  Linking.openURL(url).catch(() => {})
}
