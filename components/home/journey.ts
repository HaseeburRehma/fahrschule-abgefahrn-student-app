/**
 * "Deine Strecke zum Führerschein" — the student's journey, computed from real profile data.
 * Shared by Home (hero card / stepper) and Fortschritt (timeline) so both show the same numbers.
 */

import { format } from 'date-fns'
import { de as deLocale, enUS } from 'date-fns/locale'

import { fetchMyDoneTopics, fetchTheoryTopics } from '@/lib/data'
import type { Locale, Profile } from '@/lib/types'

export type StageKey = 'signup' | 'theory' | 'lessons' | 'theoryExam' | 'special' | 'practicalExam' | 'license'
export type StageState = 'done' | 'current' | 'upcoming' | 'locked' | 'goal'

export interface Stage {
  key: StageKey
  state: StageState
}

export interface Journey {
  stages: Stage[]
  /** 0–100 */
  percent: number
  /** completed Etappen out of TOTAL_ETAPPEN (the three special drives count individually) */
  doneEtappen: number
  theoryDone: number
  theoryTotal: number
  theoryComplete: boolean
  lessons: number
  specialDone: number
  theoryExamDate: string | null
  practicalExamDate: string | null
}

/** Anmeldung, Theorie, Fahrstunden, Theorieprüfung, 3× Sonderfahrt, Praktische Prüfung, Führerschein. */
export const TOTAL_ETAPPEN = 9
/** Fallback when the topic catalogue can't be read (Pflichtstoff Klasse B: 14 Grundstoff-Lektionen). */
export const DEFAULT_THEORY_TOTAL = 14

export function computeJourney(profile: Profile | null, theoryDone: number, theoryTotal: number): Journey {
  const total = theoryTotal > 0 ? theoryTotal : DEFAULT_THEORY_TOTAL
  const done = Math.max(0, Math.min(Number.isFinite(theoryDone) ? theoryDone : 0, total))
  const theoryPassed = profile?.theory_passed === true
  const practicalPassed = profile?.practical_passed === true
  const theoryComplete = done >= total || theoryPassed
  const rawLessons = Number(profile?.driving_lessons_count ?? 0)
  const lessons = Number.isFinite(rawLessons) ? Math.max(0, Math.floor(rawLessons)) : 0
  const specialDone = [profile?.drive_autobahn, profile?.drive_night, profile?.drive_overland].filter(Boolean).length
  const theoryExamDate = profile?.theory_exam_date ?? null
  const practicalExamDate = profile?.practical_exam_date ?? null

  const stages: Stage[] = [
    { key: 'signup', state: 'done' },
    { key: 'theory', state: theoryComplete ? 'done' : 'current' },
    { key: 'lessons', state: practicalPassed ? 'done' : lessons > 0 ? 'current' : 'upcoming' },
    {
      key: 'theoryExam',
      state: theoryPassed ? 'done' : theoryExamDate || theoryComplete ? 'current' : 'upcoming',
    },
    { key: 'special', state: specialDone >= 3 ? 'done' : specialDone > 0 ? 'current' : 'upcoming' },
    {
      key: 'practicalExam',
      state: practicalPassed ? 'done' : !theoryPassed ? 'locked' : practicalExamDate ? 'current' : 'upcoming',
    },
    { key: 'license', state: practicalPassed ? 'done' : 'goal' },
  ]

  const flags = [theoryPassed, practicalPassed, practicalPassed /* lessons */, practicalPassed /* license */]
  const doneEtappen = 1 + (theoryComplete ? 1 : 0) + specialDone + flags.filter(Boolean).length
  const progressUnits =
    1 + (theoryComplete ? 1 : done / total) + specialDone + flags.filter(Boolean).length
  const percent = Math.max(0, Math.min(100, Math.round((progressUnits / TOTAL_ETAPPEN) * 100)))

  return {
    stages,
    percent,
    doneEtappen: Math.min(doneEtappen, TOTAL_ETAPPEN),
    theoryDone: done,
    theoryTotal: total,
    theoryComplete,
    lessons,
    specialDone,
    theoryExamDate,
    practicalExamDate,
  }
}

/** Theory counts for the student (done ∩ existing topics, catalogue size). Throws on network errors. */
export async function loadTheoryCounts(uid: string): Promise<{ done: number; total: number }> {
  const [doneSet, topics] = await Promise.all([fetchMyDoneTopics(uid), fetchTheoryTopics()])
  const ids = new Set(topics.map((t) => t.id))
  const done = topics.length ? [...doneSet].filter((id) => ids.has(id)).length : doneSet.size
  return { done, total: topics.length || DEFAULT_THEORY_TOTAL }
}

const LOCALES = { de: deLocale, en: enUS }

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null
  // date-only strings ("2026-10-22") are parsed as local dates
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

/** Figma short date: "Di, 6. Okt" / "Tue, Oct 6". */
export function shortDate(iso: string, locale: Locale): string {
  const d = parse(iso)
  if (!d) return ''
  const loc = LOCALES[locale]
  const wd = format(d, 'EEE', { locale: loc }).replace(/\.$/, '')
  const mon = format(d, 'MMM', { locale: loc }).replace(/\.$/, '')
  return locale === 'de' ? `${wd}, ${d.getDate()}. ${mon}` : `${wd}, ${mon} ${d.getDate()}`
}

/** Figma long date: "Mi, 22. Okt 2026" / "Wed, Oct 22, 2026". */
export function longDate(iso: string, locale: Locale): string {
  const d = parse(iso)
  if (!d) return ''
  return locale === 'de' ? `${shortDate(iso, locale)} ${d.getFullYear()}` : `${shortDate(iso, locale)}, ${d.getFullYear()}`
}

/** "14:00 – 15:30" (or just "14:00" without an end). */
export function timeRange(startIso: string, endIso: string | null | undefined): string {
  const s = new Date(startIso)
  if (isNaN(s.getTime())) return ''
  const start = format(s, 'HH:mm')
  const e = endIso ? new Date(endIso) : null
  return e && !isNaN(e.getTime()) ? `${start} – ${format(e, 'HH:mm')}` : start
}
