import { getSupabase } from '@/lib/supabase/client'
import { cached, invalidateCache } from '@/lib/cache'

/** Map of classId → attending(true/false) for the current student. */
export function fetchMyRsvp(userId: string): Promise<Map<string, boolean>> {
  return cached(`rsvp:${userId}`, 60000, () => _fetchMyRsvp(userId)).then((m) => new Map(m))
}

async function _fetchMyRsvp(userId: string): Promise<Map<string, boolean>> {
  const { data, error } = await getSupabase()
    .from('class_rsvp')
    .select('class_id, attending')
    .eq('student_id', userId)
  if (error) throw error
  const m = new Map<string, boolean>()
  for (const r of (data ?? []) as any[]) m.set(r.class_id, r.attending)
  return m
}

export async function setRsvp(
  userId: string,
  classId: string,
  attending: boolean,
): Promise<void> {
  invalidateCache('rsvp:')
  const { error } = await getSupabase()
    .from('class_rsvp')
    .upsert(
      {
        student_id: userId,
        class_id: classId,
        attending,
        responded_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,class_id' },
    )
  if (error) throw error
}

/** Attendance summary for a class (admin view). */
export async function fetchClassAttendance(
  classId: string,
): Promise<{ yes: number; no: number }> {
  const { data, error } = await getSupabase()
    .from('class_rsvp')
    .select('attending')
    .eq('class_id', classId)
  if (error) throw error
  let yes = 0
  let no = 0
  for (const r of (data ?? []) as any[]) r.attending ? yes++ : no++
  return { yes, no }
}
