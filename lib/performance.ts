/**
 * Derived performance metrics for the admin dashboard (pure, unit tested).
 */

import type { StudentPerformance } from '@/lib/invites'

export const TOPIC_COUNT = 14
const DAY = 86_400_000

export type Flag = 'inactive' | 'exam_soon' | 'struggling' | 'ready' | 'new'
export type SortKey = 'name' | 'readiness' | 'accuracy' | 'activity' | 'xp_week' | 'lessons' | 'exam'
export type FilterKey = 'all' | Flag

export interface Derived {
  name: string
  /** 0–100 or null when the student hasn't played a quiz yet */
  accuracy: number | null
  theoryPct: number
  masteredPct: number
  /** 0–100: mastered topics 50 %, accuracy 30 %, topics marked done 20 % */
  readiness: number
  daysSinceActive: number | null
  nextExam: { kind: 'theory' | 'practical'; date: string; inDays: number } | null
  flags: Flag[]
}

/** Calendar date in Berlin, as YYYY-MM-DD. */
export function berlinDay(d: Date): string {
  try {
    const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  } catch {
    /* engine without time-zone support → device-local date below */
  }
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / DAY)
}

export function fullName(p: Pick<StudentPerformance, 'first_name' | 'last_name' | 'email'>): string {
  const n = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return n || p.email || '—'
}

export function derive(p: StudentPerformance, now = new Date()): Derived {
  const today = berlinDay(now)
  const accuracy = p.quiz_questions > 0 ? Math.round((100 * p.quiz_correct) / p.quiz_questions) : null
  const theoryPct = Math.round((100 * Math.min(p.topics_done, TOPIC_COUNT)) / TOPIC_COUNT)
  const masteredPct = Math.round((100 * Math.min(p.topics_mastered, TOPIC_COUNT)) / TOPIC_COUNT)
  const readiness = Math.round(0.5 * masteredPct + 0.3 * (accuracy ?? 0) + 0.2 * theoryPct)

  const lastQuizDay = p.last_quiz_at ? berlinDay(new Date(p.last_quiz_at)) : null
  const lastDay = [p.last_active_on, lastQuizDay].filter(Boolean).sort().pop() ?? null
  const daysSinceActive = lastDay ? Math.max(0, daysBetween(lastDay, today)) : null

  const exams: Derived['nextExam'][] = []
  if (p.theory_exam_date && p.theory_passed !== true) {
    exams.push({ kind: 'theory', date: p.theory_exam_date, inDays: daysBetween(today, p.theory_exam_date) })
  }
  if (p.practical_exam_date && p.practical_passed !== true) {
    exams.push({ kind: 'practical', date: p.practical_exam_date, inDays: daysBetween(today, p.practical_exam_date) })
  }
  const nextExam = exams.filter((e) => e && e.inDays >= 0).sort((a, b) => a!.inDays - b!.inDays)[0] ?? null

  const flags: Flag[] = []
  const joinedDays = daysBetween(berlinDay(new Date(p.joined_at)), today)
  if (joinedDays <= 7 && p.quiz_rounds === 0) flags.push('new')
  else if (daysSinceActive === null || daysSinceActive >= 7) flags.push('inactive')
  if (nextExam && nextExam.inDays <= 14) flags.push('exam_soon')
  if (p.quiz_rounds >= 3 && accuracy !== null && accuracy < 60) flags.push('struggling')
  if (p.topics_mastered >= 12 && (accuracy ?? 0) >= 80) flags.push('ready')

  return { name: fullName(p), accuracy, theoryPct, masteredPct, readiness, daysSinceActive, nextExam, flags }
}

export function matches(p: StudentPerformance, d: Derived, query: string, filter: FilterKey): boolean {
  if (filter !== 'all' && !d.flags.includes(filter)) return false
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${d.name} ${p.email ?? ''} ${p.student_code ?? ''}`.toLowerCase().includes(q)
}

export function sortRows<T extends { p: StudentPerformance; d: Derived }>(rows: T[], key: SortKey, desc: boolean): T[] {
  const val = (r: T): number | string => {
    switch (key) {
      case 'name':
        return r.d.name.toLowerCase()
      case 'readiness':
        return r.d.readiness
      case 'accuracy':
        return r.d.accuracy ?? -1
      case 'activity':
        return r.d.daysSinceActive === null ? Number.MAX_SAFE_INTEGER : r.d.daysSinceActive
      case 'xp_week':
        return r.p.xp_week
      case 'lessons':
        return Math.max(r.p.driving_lessons, r.p.lessons_completed)
      case 'exam':
        return r.d.nextExam ? r.d.nextExam.inDays : Number.MAX_SAFE_INTEGER
    }
  }
  const dir = desc ? -1 : 1
  return [...rows].sort((a, b) => {
    const x = val(a)
    const y = val(b)
    if (x < y) return -1 * dir
    if (x > y) return 1 * dir
    return a.d.name.localeCompare(b.d.name)
  })
}

export interface Kpis {
  students: number
  activeWeek: number
  avgAccuracy: number | null
  quizRoundsTotal: number
  xpWeek: number
  examsSoon: number
  inactive: number
}

export function kpis(rows: { p: StudentPerformance; d: Derived }[]): Kpis {
  const active = rows.filter((r) => r.p.is_active)
  const withAcc = active.filter((r) => r.d.accuracy !== null)
  const q = withAcc.reduce((s, r) => s + r.p.quiz_questions, 0)
  const c = withAcc.reduce((s, r) => s + r.p.quiz_correct, 0)
  return {
    students: active.length,
    activeWeek: active.filter((r) => r.d.daysSinceActive !== null && r.d.daysSinceActive < 7).length,
    avgAccuracy: q > 0 ? Math.round((100 * c) / q) : null,
    quizRoundsTotal: active.reduce((s, r) => s + r.p.quiz_rounds, 0),
    xpWeek: active.reduce((s, r) => s + r.p.xp_week, 0),
    examsSoon: active.filter((r) => r.d.flags.includes('exam_soon')).length,
    inactive: active.filter((r) => r.d.flags.includes('inactive')).length,
  }
}

// ── CSV export ──────────────────────────────────────────────────────────────

/** Spreadsheet-safe cell: quoted, and formula-looking values neutralised (CSV injection). */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

/** Semicolon-separated with BOM — opens with umlauts intact in German Excel. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')
}
