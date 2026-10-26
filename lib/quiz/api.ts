/** Supabase access for the Theorie-Quiz (migration 20261026000001_quiz_gamification). */

import { getSupabase } from '@/lib/supabase/client'
import { cached, invalidateCache } from '@/lib/cache'
import type { QuizAttempt } from './gamification'

export interface LeagueRow {
  rank: number
  display_name: string
  initial: string
  xp: number
  is_me: boolean
}

export interface RecordedAttempt {
  xp: number
  mastered: boolean
  streak_days: number
}

/** Saves a finished round; XP and "mastered" are decided by the server. */
export async function recordQuizAttempt(input: {
  topic: number
  total: number
  correct: number
  durationMs: number
}): Promise<RecordedAttempt> {
  const { data, error } = await getSupabase().rpc('record_quiz_attempt', {
    p_topic: input.topic,
    p_total: input.total,
    p_correct: input.correct,
    p_duration_ms: Math.max(0, Math.min(7_200_000, Math.round(input.durationMs))),
  })
  if (error) throw error
  invalidateCache('quiz:')
  const row = (Array.isArray(data) ? data[0] : data) as RecordedAttempt | undefined
  if (!row) throw new Error('empty quiz result')
  return row
}

/** The student's own rounds, newest first (RLS limits rows to the caller). */
export function fetchMyQuizAttempts(uid: string): Promise<QuizAttempt[]> {
  return cached(`quiz:attempts:${uid}`, 30_000, async () => {
    const { data, error } = await getSupabase()
      .from('quiz_attempts')
      .select('id, topic_number, total, correct, xp, duration_ms, mastered, created_at')
      .eq('student_id', uid)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) throw error
    return (data ?? []) as QuizAttempt[]
  })
}

export function fetchLeague(): Promise<LeagueRow[]> {
  return cached('quiz:league', 30_000, async () => {
    const { data, error } = await getSupabase().rpc('quiz_league')
    if (error) throw error
    return (data ?? []) as LeagueRow[]
  })
}
