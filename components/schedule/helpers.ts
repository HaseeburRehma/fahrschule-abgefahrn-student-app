/**
 * Shared helpers for the Termine area: lesson types, icons, Figma date formats.
 */

import { format } from 'date-fns/format'
import { de as deLocale } from 'date-fns/locale/de'
import { enUS } from 'date-fns/locale/en-US'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { BookOpen } from 'phosphor-react-native/src/icons/BookOpen'
import { Exam } from 'phosphor-react-native/src/icons/Exam'
import { Moon } from 'phosphor-react-native/src/icons/Moon'
import { RoadHorizon } from 'phosphor-react-native/src/icons/RoadHorizon'
import { SteeringWheel } from 'phosphor-react-native/src/icons/SteeringWheel'

import type { Appointment } from '@/lib/appointments'
import type { Locale } from '@/lib/types'

export type LessonType = 'regular' | 'autobahn' | 'night' | 'overland' | 'exam_prep'
export const SPECIAL_KINDS = ['autobahn', 'night', 'overland'] as const
export type SpecialKind = (typeof SPECIAL_KINDS)[number]

const KNOWN: LessonType[] = ['regular', 'autobahn', 'night', 'overland', 'exam_prep']

/** lesson_type column if present (v2 migration), otherwise inferred from the title. */
export function lessonTypeOf(a: Pick<Appointment, 'lesson_type' | 'title'>): LessonType | null {
  const lt = (a.lesson_type ?? '').toLowerCase()
  if (KNOWN.includes(lt as LessonType)) return lt as LessonType
  const title = (a.title ?? '').toLowerCase()
  if (title.includes('autobahn') || title.includes('highway')) return 'autobahn'
  if (title.includes('nacht') || title.includes('night')) return 'night'
  if (title.includes('überland') || title.includes('uberland') || title.includes('overland') || title.includes('country'))
    return 'overland'
  if (title.includes('prüfung') || title.includes('exam')) return 'exam_prep'
  return null
}

export function isSpecial(type: LessonType | null): boolean {
  return type === 'autobahn' || type === 'night' || type === 'overland'
}

export function lessonIcon(type: LessonType | null): PhosphorIcon {
  if (type === 'autobahn' || type === 'overland') return RoadHorizon
  if (type === 'night') return Moon
  if (type === 'exam_prep') return Exam
  return SteeringWheel
}

export const TheoryIcon = BookOpen

/** Card subtitle: "Regelfahrt mit Marco" / "Sonderfahrt mit Marco" / "Regelfahrt" / "mit Marco". */
export function lessonSubtitle(
  a: Appointment,
  t: (k: string, v?: Record<string, string | number>) => string,
): string {
  const type = lessonTypeOf(a)
  const typeLabel = type ? (isSpecial(type) ? t('schedule.v2.type.special') : t(`schedule.v2.type.${type}`)) : null
  // Figma uses the first name only ("Regelfahrt mit Marco"); the detail screen shows the full name.
  const name = instructorFirstName(a)
  if (typeLabel && name) return t('schedule.v2.with', { type: typeLabel, name })
  if (typeLabel) return typeLabel
  if (name) return t('schedule.v2.withOnly', { name })
  return ''
}

/**
 * Display title: appointments store a German title ("Fahrstunde", "Autobahnfahrt" …).
 * In English, translate the standard titles (Figma EN: "Lesson with Marco"); custom titles stay as entered.
 */
export function lessonTitle(
  a: Pick<Appointment, 'title'>,
  t: (k: string, v?: Record<string, string | number>) => string,
  locale: Locale,
): string {
  if (locale === 'de') return a.title
  const key: Record<string, string> = {
    fahrstunde: 'schedule.v2.title.lesson',
    theoriestunde: 'schedule.v2.title.theory',
    autobahnfahrt: 'schedule.v2.type.autobahn',
    nachtfahrt: 'schedule.v2.type.night',
    'überlandfahrt': 'schedule.v2.type.overland',
    sonderfahrt: 'schedule.v2.type.special',
    'prüfungsvorbereitung': 'schedule.v2.type.exam_prep',
  }
  const k = key[(a.title ?? '').trim().toLowerCase()]
  return k ? t(k) : a.title
}

export function instructorFirstName(a: Pick<Appointment, 'instructor_name'>): string | null {
  return a.instructor_name?.trim().split(/\s+/)[0] || null
}

/* ------------------------------------------------------------------ dates */

const DE_MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const DE_DAY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

/** "Di, 6. Okt" / "Tue, Oct 6" */
export function shortDate(iso: string, locale: Locale): string {
  const d = new Date(iso)
  if (!iso || isNaN(d.getTime())) return ''
  if (locale === 'de') return `${DE_DAY[d.getDay()]}, ${d.getDate()}. ${DE_MON[d.getMonth()]}`
  return format(d, 'EEE, MMM d', { locale: enUS })
}

/** "Di, 6. Oktober 2026" / "Tue, 6 October 2026" */
export function longDate(iso: string, locale: Locale): string {
  const d = new Date(iso)
  if (!iso || isNaN(d.getTime())) return ''
  if (locale === 'de') return `${DE_DAY[d.getDay()]}, ${format(d, 'd. MMMM yyyy', { locale: deLocale })}`
  return format(d, 'EEE, d MMMM yyyy', { locale: enUS })
}

/** "14:00" */
export function hm(iso: string): string {
  const d = new Date(iso)
  if (!iso || isNaN(d.getTime())) return ''
  return format(d, 'HH:mm')
}

/** Short weekday "Mo" / "Mo" (EN two-letter). */
export function weekdayShort(d: Date, locale: Locale): string {
  if (locale === 'de') return DE_DAY[d.getDay()]
  return format(d, 'EEEEEE', { locale: enUS })
}

/** "Oktober 2026" / "October 2026" */
export function monthYear(d: Date, locale: Locale): string {
  return format(d, 'MMMM yyyy', { locale: locale === 'de' ? deLocale : enUS })
}

/** Local YYYY-MM-DD key for grouping slots per day. */
export function dayKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (isNaN(d.getTime())) return 'invalid'
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** "14:00 – 15:30 Uhr  ·  90 Min" (or "14:00 Uhr" without an end). */
export function timeRange(
  startIso: string,
  endIso: string | null | undefined,
  t: (k: string) => string,
): string {
  const uhr = t('appointment.v2.uhr')
  const suffix = uhr ? ` ${uhr}` : ''
  const start = hm(startIso)
  if (!start) return ''
  const end = endIso ? hm(endIso) : ''
  if (!end) return `${start}${suffix}`
  const mins = Math.round((new Date(endIso as string).getTime() - new Date(startIso).getTime()) / 60000)
  const base = `${start} – ${end}${suffix}`
  return mins > 0 ? `${base}  ·  ${mins} ${t('appointment.v2.min')}` : base
}

/** End (or start) of an event — what decides upcoming vs. past. */
export function endTime(e: { starts_at: string; ends_at?: string | null }): number {
  return new Date(e.ends_at ?? e.starts_at).getTime()
}

/* ------------------------------------------------------------------ errors */

/**
 * Friendly i18n key for a failed appointment write (book / cancel). Server rules:
 *  - `slot_full`       availability slot already booked (trigger)
 *  - `starts_in_past`  requested start time is in the past (trigger)
 *  - RLS / permission  students may only cancel, never edit or delete confirmed lessons
 */
export function appointmentErrorKey(e: any): string {
  const text = `${e?.message ?? ''} ${e?.details ?? ''} ${e?.hint ?? ''}`.toLowerCase()
  const code = String(e?.code ?? '')
  if (text.includes('slot_full')) return 'booking.v2.slotFull'
  if (text.includes('starts_in_past')) return 'booking.v2.inPast'
  if (
    code === '42501' ||
    code === 'PGRST116' || // update matched no row the student may change
    text.includes('row-level security') ||
    text.includes('permission denied') ||
    text.includes('not allowed')
  )
    return 'appointment.v2.notAllowed'
  if (/network|failed to fetch|fetch failed|timeout|timed out|offline|load failed/.test(`${e?.name ?? ''} ${text}`.toLowerCase()))
    return 'schedule.v2.offline'
  return 'schedule.v2.error'
}
