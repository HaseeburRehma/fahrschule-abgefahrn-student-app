import { describe, expect, it } from 'vitest'

import type { StudentPerformance } from '../lib/invites'
import { csvCell, derive, kpis, matches, sortRows, toCsv } from '../lib/performance'

const NOW = new Date('2026-11-10T12:00:00Z')

function perf(p: Partial<StudentPerformance> = {}): StudentPerformance {
  return {
    student_id: 'id',
    first_name: 'Max',
    last_name: 'Muster',
    email: 'max@example.de',
    student_code: 'K-1001',
    is_active: true,
    joined_at: '2026-09-01T10:00:00Z',
    last_active_on: '2026-11-09',
    streak_days: 3,
    topics_done: 7,
    topics_mastered: 7,
    quiz_rounds: 10,
    quiz_questions: 100,
    quiz_correct: 80,
    xp_total: 900,
    xp_week: 120,
    last_quiz_at: '2026-11-09T18:00:00Z',
    driving_lessons: 12,
    lessons_completed: 10,
    lessons_upcoming: 2,
    drive_autobahn: true,
    drive_night: false,
    drive_overland: false,
    theory_exam_date: null,
    practical_exam_date: null,
    theory_passed: null,
    practical_passed: null,
    ...p,
  }
}

describe('derive', () => {
  it('computes accuracy, progress and readiness', () => {
    const d = derive(perf(), NOW)
    expect(d.accuracy).toBe(80)
    expect(d.theoryPct).toBe(50)
    expect(d.masteredPct).toBe(50)
    expect(d.readiness).toBe(Math.round(0.5 * 50 + 0.3 * 80 + 0.2 * 50))
    expect(d.daysSinceActive).toBe(1)
    expect(d.flags).toEqual([])
  })

  it('flags inactive, struggling, exam soon, ready and new students', () => {
    expect(derive(perf({ last_active_on: '2026-10-01', last_quiz_at: null }), NOW).flags).toContain('inactive')
    expect(derive(perf({ last_active_on: null, last_quiz_at: null }), NOW).flags).toContain('inactive')
    expect(derive(perf({ quiz_rounds: 5, quiz_questions: 50, quiz_correct: 20 }), NOW).flags).toContain('struggling')
    expect(derive(perf({ topics_mastered: 13, quiz_correct: 90 }), NOW).flags).toContain('ready')
    const exam = derive(perf({ theory_exam_date: '2026-11-20' }), NOW)
    expect(exam.flags).toContain('exam_soon')
    expect(exam.nextExam).toEqual({ kind: 'theory', date: '2026-11-20', inDays: 10 })
    const fresh = derive(perf({ joined_at: '2026-11-08T09:00:00Z', quiz_rounds: 0, quiz_questions: 0, quiz_correct: 0, last_active_on: null, last_quiz_at: null }), NOW)
    expect(fresh.flags).toEqual(['new'])
    expect(fresh.accuracy).toBeNull()
  })

  it('ignores passed and past exams', () => {
    expect(derive(perf({ theory_exam_date: '2026-11-12', theory_passed: true }), NOW).nextExam).toBeNull()
    expect(derive(perf({ practical_exam_date: '2026-11-01' }), NOW).nextExam).toBeNull()
  })

  it('uses the later of app activity and last quiz', () => {
    expect(derive(perf({ last_active_on: '2026-10-01', last_quiz_at: '2026-11-08T10:00:00Z' }), NOW).daysSinceActive).toBe(2)
  })
})

describe('filtering, sorting and KPIs', () => {
  const a = perf({ student_id: 'a', first_name: 'Anna', last_name: 'Beck', email: 'anna@x.de', quiz_correct: 95 })
  const b = perf({ student_id: 'b', first_name: 'Zoe', last_name: 'Ziegler', email: 'zoe@x.de', last_active_on: '2026-10-01', last_quiz_at: null, quiz_correct: 50 })
  const c = perf({ student_id: 'c', first_name: 'Carl', last_name: 'Cole', is_active: false, quiz_questions: 0, quiz_correct: 0, quiz_rounds: 0 })
  const rows = [a, b, c].map((p) => ({ p, d: derive(p, NOW) }))

  it('filters by flag and search text', () => {
    expect(rows.filter((r) => matches(r.p, r.d, '', 'inactive')).map((r) => r.p.student_id)).toEqual(['b'])
    expect(rows.filter((r) => matches(r.p, r.d, 'ZOE', 'all')).map((r) => r.p.student_id)).toEqual(['b'])
    expect(rows.filter((r) => matches(r.p, r.d, 'k-1001', 'all'))).toHaveLength(3)
  })

  it('sorts by name and accuracy', () => {
    expect(sortRows(rows, 'name', false).map((r) => r.p.student_id)).toEqual(['a', 'c', 'b'])
    expect(sortRows(rows, 'accuracy', true).map((r) => r.p.student_id)).toEqual(['a', 'b', 'c'])
    expect(sortRows(rows, 'activity', false).map((r) => r.p.student_id)[0]).toBe('a')
  })

  it('counts only active students in the KPIs', () => {
    const k = kpis(rows)
    expect(k.students).toBe(2)
    expect(k.activeWeek).toBe(1)
    expect(k.avgAccuracy).toBe(Math.round((100 * (95 + 50)) / 200))
    expect(k.inactive).toBe(1)
  })
})

describe('CSV export', () => {
  it('quotes cells and neutralises formulas', () => {
    expect(csvCell('Max')).toBe('"Max"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"')
    expect(csvCell('+49 176')).toBe('"\'+49 176"')
    expect(csvCell(null)).toBe('""')
  })

  it('writes a BOM and semicolons for German Excel', () => {
    const csv = toCsv(['Name', 'Quote'], [['Jörg', 80]])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toBe('﻿"Name";"Quote"\r\n"Jörg";"80"')
  })
})
