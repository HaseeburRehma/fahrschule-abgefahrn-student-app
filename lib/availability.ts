import { getSupabase } from '@/lib/supabase/client'

export interface Slot {
  id: string
  starts_at: string
  ends_at: string | null
  capacity: number
  note: string | null
  created_at: string
}
export interface SlotWithCount extends Slot {
  booked: number
}

async function withCounts(slots: Slot[]): Promise<SlotWithCount[]> {
  if (!slots.length) return []
  const ids = slots.map((s) => s.id)
  const { data } = await getSupabase()
    .from('appointments')
    .select('slot_id, status')
    .in('slot_id', ids)
    .neq('status', 'cancelled')
  const counts = new Map<string, number>()
  for (const r of (data ?? []) as any[]) {
    if (!r.slot_id) continue
    counts.set(r.slot_id, (counts.get(r.slot_id) ?? 0) + 1)
  }
  return slots.map((s) => ({ ...s, booked: counts.get(s.id) ?? 0 }))
}

/** Future slots with a free spot — what students can book. */
export async function fetchAvailableSlots(): Promise<SlotWithCount[]> {
  const { data, error } = await getSupabase()
    .from('availability_slots')
    .select('*')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
  if (error) throw error
  const withC = await withCounts((data ?? []) as Slot[])
  return withC.filter((s) => s.booked < s.capacity)
}

/** Admin: all future slots with their booked counts. */
export async function fetchSlots(): Promise<SlotWithCount[]> {
  const { data, error } = await getSupabase()
    .from('availability_slots')
    .select('*')
    .order('starts_at', { ascending: true })
  if (error) throw error
  return withCounts((data ?? []) as Slot[])
}

export async function createSlot(input: {
  starts_at: string
  ends_at?: string | null
  capacity?: number
  note?: string | null
}): Promise<void> {
  const { error } = await getSupabase().from('availability_slots').insert({
    starts_at: input.starts_at,
    ends_at: input.ends_at ?? null,
    capacity: input.capacity ?? 1,
    note: input.note ?? null,
  })
  if (error) throw error
}

export async function deleteSlot(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('availability_slots')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/** Student books a slot → an auto-confirmed appointment (trigger enforces
 * capacity + copies the slot's time). */
export async function bookSlot(
  studentId: string,
  slot: Slot,
  title: string,
): Promise<void> {
  const { error } = await getSupabase().from('appointments').insert({
    student_id: studentId,
    title: slot.note || title,
    slot_id: slot.id,
    starts_at: slot.starts_at, // trigger re-derives from the slot
    ends_at: slot.ends_at,
    status: 'confirmed',
  })
  if (error) throw error
}
