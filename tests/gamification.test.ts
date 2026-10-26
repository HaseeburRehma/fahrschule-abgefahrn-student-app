import { describe, expect, it } from 'vitest'
import {
  badges,
  daysLeftInWeek,
  formatDuration,
  leagueTier,
  todayCount,
  totalXp,
  weekDays,
  weekStart,
  weekXp,
  type QuizAttempt,
} from '@/lib/quiz/gamification'

// Fixed local time: Thursday 29 Oct 2026, 15:00 (week starts Monday 26 Oct)
const NOW = new Date(2026, 9, 29, 15, 0)

let n = 0
function attempt(date: Date, extra: Partial<QuizAttempt> = {}): QuizAttempt {
  return {
    id: String(++n),
    topic_number: 1,
    total: 10,
    correct: 8,
    xp: 80,
    duration_ms: 60_000,
    mastered: true,
    created_at: date.toISOString(),
    ...extra,
  }
}

describe('week helpers', () => {
  it('weekStart is Monday 00:00', () => {
    const ws = weekStart(NOW)
    expect(ws.getDay()).toBe(1)
    expect(ws.getHours()).toBe(0)
    expect(ws.getDate()).toBe(26)
  })

  it('weekDays marks played, missed, today and future days', () => {
    const days = weekDays([attempt(new Date(2026, 9, 26, 10)), attempt(new Date(2026, 9, 27, 9))], NOW)
    expect(days).toEqual(['done', 'done', 'missed', 'today', 'future', 'future', 'future'])
    const withToday = weekDays([attempt(new Date(2026, 9, 29, 8))], NOW)
    expect(withToday[3]).toBe('todayDone')
  })

  it('weekXp ignores last week, totalXp does not', () => {
    const list = [attempt(new Date(2026, 9, 25, 12), { xp: 50 }), attempt(new Date(2026, 9, 28, 12), { xp: 70 })]
    expect(weekXp(list, NOW)).toBe(70)
    expect(totalXp(list)).toBe(120)
  })

  it('todayCount counts only today', () => {
    expect(todayCount([attempt(new Date(2026, 9, 29, 1)), attempt(new Date(2026, 9, 28, 23))], NOW)).toBe(1)
  })

  it('daysLeftInWeek counts down to Sunday night and never hits 0', () => {
    expect(daysLeftInWeek(NOW)).toBe(4)
    expect(daysLeftInWeek(new Date(2026, 10, 1, 23, 59))).toBe(1)
  })
})

describe('league tier', () => {
  it('climbs with XP', () => {
    expect(leagueTier(0)).toBe('bronze')
    expect(leagueTier(500)).toBe('silver')
    expect(leagueTier(1500)).toBe('gold')
    expect(leagueTier(4000)).toBe('diamond')
  })
})

describe('badges', () => {
  const profile = {
    driving_lessons_count: 0,
    drive_night: false,
    drive_overland: false,
    drive_autobahn: false,
    theory_passed: null,
    practical_passed: null,
    streak_days: 0,
  }

  it('a brand-new student only has "registered"', () => {
    const b = badges({ profile, attempts: [], doneTopics: 0, totalTopics: 14 })
    expect(b.filter((x) => x.unlocked).map((x) => x.key)).toEqual(['registered'])
  })

  it('unlocks from real data', () => {
    const attempts = Array.from({ length: 10 }, () => attempt(NOW, { correct: 10, xp: 120 }))
    const b = badges({
      profile: { ...profile, driving_lessons_count: 12, drive_night: true, streak_days: 7, theory_passed: true, practical_passed: true },
      attempts,
      doneTopics: 14,
      totalTopics: 14,
    })
    const on = new Set(b.filter((x) => x.unlocked).map((x) => x.key))
    for (const k of ['theoryStart', 'firstQuiz', 'streak7', 'lessons10', 'quizPro', 'perfectQuiz', 'night', 'allTopics', 'xp1000', 'theoryExam', 'practicalExam', 'license'] as const) {
      expect(on.has(k), k).toBe(true)
    }
    expect(on.has('overland')).toBe(false)
  })
})

describe('formatting', () => {
  it('formatDuration renders m:ss', () => {
    expect(formatDuration(252_000)).toBe('4:12')
    expect(formatDuration(-1)).toBe('0:00')
  })
})
