/**
 * Date helpers for the Theorie / Prüfungen screens (Figma formats:
 * "Mi, 7. Okt" / "Wed, Oct 7", "Mi, 22. Okt 2026" / "Wed, Oct 22 2026").
 */

import { format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import type { Locale } from '@/lib/types'

/** Short weekday + day + month without the trailing abbreviation dot. */
export function shortDate(d: Date, locale: Locale, withYear = false): string {
  if (locale === 'de') {
    const wd = format(d, 'EEEEEE', { locale: de })
    const mon = format(d, 'MMM', { locale: de }).replace(/\.$/, '')
    return `${wd}, ${format(d, 'd')}. ${mon}${withYear ? ` ${format(d, 'yyyy')}` : ''}`
  }
  return format(d, withYear ? 'EEE, MMM d yyyy' : 'EEE, MMM d', { locale: enUS })
}

export function hhmm(d: Date): string {
  return format(d, 'HH:mm')
}

/** "2026-10-22" → local Date at midnight (null if invalid). */
export function parseIsoDay(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? null : d
}

/** Whole days from today (local) until the given ISO day; negative when past. */
export function daysUntil(s: string): number | null {
  const d = parseIsoDay(s)
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

/** "22.10.2026" → "2026-10-22" (null unless it is a real calendar date). */
export function deDateToIso(input: string): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(input.trim())
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  if (year < 2000 || year > 2100) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** "2026-10-22" → "22.10.2026". */
export function isoToDeDate(s: string | null | undefined): string {
  const d = parseIsoDay(s)
  if (!d) return ''
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

/** Auto-insert dots while typing: "22102026" → "22.10.2026". */
export function maskDeDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}
