import { getSupabase } from '@/lib/supabase/client'
import type { ReminderItem } from '@/lib/reminders'

export interface MotivationMessage {
  id: string
  body_de: string
  body_en: string
  active: boolean
  sort: number
}

export async function fetchMotivationMessages(
  activeOnly = true,
): Promise<MotivationMessage[]> {
  let q = getSupabase()
    .from('motivation_messages')
    .select('*')
    .order('sort', { ascending: true })
  if (activeOnly) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as MotivationMessage[]
}

export async function createMotivation(
  body_de: string,
  body_en: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('motivation_messages')
    .insert({ body_de, body_en })
  if (error) throw error
}

export async function deleteMotivation(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('motivation_messages')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/**
 * Build one motivation notification per day (at 09:00) from tomorrow until the
 * exam (capped ~45 days), cycling through the message pool.
 */
export function buildMotivationItems(
  examDate: Date,
  bodies: string[],
  titleFn: (daysLeft: number) => string,
): ReminderItem[] {
  if (!bodies.length) return []
  const items: ReminderItem[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(examDate)
  end.setHours(0, 0, 0, 0)

  let day = new Date(today)
  day.setDate(day.getDate() + 1) // start tomorrow
  let i = 0
  let guard = 0
  while (day.getTime() <= end.getTime() && guard < 45) {
    const fireAt = new Date(day)
    fireAt.setHours(9, 0, 0, 0)
    const daysLeft = Math.max(
      0,
      Math.round((end.getTime() - day.getTime()) / 86_400_000),
    )
    items.push({
      id: `motiv-${day.toISOString().slice(0, 10)}`,
      fireAt,
      title: titleFn(daysLeft),
      body: bodies[i % bodies.length],
    })
    day.setDate(day.getDate() + 1)
    i++
    guard++
  }
  return items
}
