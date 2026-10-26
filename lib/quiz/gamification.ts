/**
 * Pure gamification rules for the Figma sections 09 / 11 (no React, no I/O).
 * All dates are evaluated in the device's local time, which for this school is
 * Europe/Berlin; the server uses Berlin time for streaks and the league week.
 */

import type { Profile } from '@/lib/types'

export interface QuizAttempt {
  id: string
  topic_number: number
  total: number
  correct: number
  xp: number
  duration_ms: number
  mastered: boolean
  created_at: string
}

/** Quiz rounds per day for the "Tagesziel" ring. */
export const DAILY_GOAL = 2

const DAY_MS = 86_400_000

/** Monday 00:00 (local) of the week containing `d`. */
export function weekStart(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (s.getDay() + 6) % 7 // Mon=0 … Sun=6
  s.setDate(s.getDate() - dow)
  return s
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function totalXp(attempts: readonly QuizAttempt[]): number {
  return attempts.reduce((s, a) => s + a.xp, 0)
}

export function weekXp(attempts: readonly QuizAttempt[], now = new Date()): number {
  const from = weekStart(now).getTime()
  return attempts.filter((a) => new Date(a.created_at).getTime() >= from).reduce((s, a) => s + a.xp, 0)
}

export function todayCount(attempts: readonly QuizAttempt[], now = new Date()): number {
  return attempts.filter((a) => sameDay(new Date(a.created_at), now)).length
}

export type DayState = 'done' | 'today' | 'todayDone' | 'missed' | 'future'

/** Mon–Sun dots for "Tagesziel" / "Streak": which days had at least one round. */
export function weekDays(attempts: readonly QuizAttempt[], now = new Date()): DayState[] {
  const start = weekStart(now)
  const played = new Set(
    attempts.map((a) => {
      const d = new Date(a.created_at)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    }),
  )
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (sameDay(d, now)) return played.has(key) ? 'todayDone' : 'today'
    if (d.getTime() > now.getTime()) return 'future'
    return played.has(key) ? 'done' : 'missed'
  })
}

/** Whole days until the league week ends (Sunday 24:00), at least 1. */
export function daysLeftInWeek(now = new Date()): number {
  const end = weekStart(now).getTime() + 7 * DAY_MS
  return Math.max(1, Math.ceil((end - now.getTime()) / DAY_MS))
}

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'diamond'

/** Tier from all-time XP (the "Gold-Liga" pill). */
export function leagueTier(xp: number): LeagueTier {
  if (xp >= 4000) return 'diamond'
  if (xp >= 1500) return 'gold'
  if (xp >= 500) return 'silver'
  return 'bronze'
}

/** Ranks above this line are in the "Aufstiegszone" (promotion zone). */
export const PROMOTION_ZONE = 5

export type BadgeKey =
  | 'registered'
  | 'theoryStart'
  | 'firstQuiz'
  | 'streak7'
  | 'lessons10'
  | 'quizPro'
  | 'perfectQuiz'
  | 'night'
  | 'overland'
  | 'autobahn'
  | 'allTopics'
  | 'xp1000'
  | 'theoryExam'
  | 'practicalExam'
  | 'license'

export interface Badge {
  key: BadgeKey
  unlocked: boolean
  /** amber ring for streak-type badges (Figma fire badge) */
  tone: 'green' | 'gold'
}

export interface BadgeInput {
  profile: Pick<
    Profile,
    'driving_lessons_count' | 'drive_night' | 'drive_overland' | 'drive_autobahn' | 'theory_passed' | 'practical_passed'
  > & { streak_days?: number | null }
  attempts: readonly QuizAttempt[]
  doneTopics: number
  totalTopics: number
}

/** Badge grid for "Abzeichen" — every badge is backed by real data. */
export function badges({ profile, attempts, doneTopics, totalTopics }: BadgeInput): Badge[] {
  const masteredRounds = attempts.filter((a) => a.mastered).length
  const list: [BadgeKey, boolean, Badge['tone']?][] = [
    ['registered', true],
    ['theoryStart', doneTopics > 0],
    ['firstQuiz', attempts.length > 0],
    ['streak7', (profile.streak_days ?? 0) >= 7, 'gold'],
    ['lessons10', (profile.driving_lessons_count ?? 0) >= 10],
    ['quizPro', masteredRounds >= 10],
    ['perfectQuiz', attempts.some((a) => a.total > 0 && a.correct === a.total)],
    ['night', !!profile.drive_night],
    ['overland', !!profile.drive_overland],
    ['autobahn', !!profile.drive_autobahn],
    ['allTopics', totalTopics > 0 && doneTopics >= totalTopics],
    ['xp1000', totalXp(attempts) >= 1000, 'gold'],
    ['theoryExam', profile.theory_passed === true],
    ['practicalExam', profile.practical_passed === true],
    ['license', profile.theory_passed === true && profile.practical_passed === true, 'gold'],
  ]
  return list.map(([key, unlocked, tone]) => ({ key, unlocked, tone: tone ?? 'green' }))
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** German thousands separator, as in the Figma HUD ("1.250"). */
export function formatXp(xp: number, locale: 'de' | 'en'): string {
  return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-US').format(xp)
}
