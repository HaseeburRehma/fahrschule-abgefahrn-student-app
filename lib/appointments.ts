import { getSupabase } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

export type AppointmentStatus = 'requested' | 'confirmed' | 'cancelled'

export interface Appointment {
  id: string
  student_id: string
  title: string
  starts_at: string
  ends_at: string | null
  note: string | null
  status: AppointmentStatus
  created_at: string
  /** v2 — optional until migration 20261005000001 is applied */
  instructor_name?: string | null
  meeting_point?: string | null
  lesson_type?: string | null
  slot_id?: string | null
}

export async function fetchMyAppointments(
  studentId: string,
): Promise<Appointment[]> {
  const { data, error } = await getSupabase()
    .from('appointments')
    .select('*')
    .eq('student_id', studentId)
    .order('starts_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Appointment[]
}

export async function createAppointment(input: {
  studentId: string
  title: string
  starts_at: string
  ends_at?: string | null
  note?: string | null
  /** book an availability slot (DB trigger capacity-checks + auto-confirms) */
  slot_id?: string | null
  /** v2 optional column — dropped automatically if the migration isn't applied */
  lesson_type?: string | null
}): Promise<Appointment> {
  const base: Record<string, unknown> = {
    student_id: input.studentId,
    title: input.title,
    starts_at: input.starts_at,
    ends_at: input.ends_at ?? null,
    note: input.note ?? null,
  }
  if (input.slot_id) base.slot_id = input.slot_id
  const insert = (row: Record<string, unknown>) =>
    getSupabase().from('appointments').insert(row).select('*').single()

  let res = input.lesson_type ? await insert({ ...base, lesson_type: input.lesson_type }) : await insert(base)
  if (res.error && input.lesson_type && isMissingColumn(res.error)) {
    res = await insert(base)
  }
  if (res.error) throw res.error
  return res.data as Appointment
}

/** Postgres/PostgREST "column does not exist" (optional v2 columns not migrated yet). */
function isMissingColumn(err: { code?: string; message?: string }): boolean {
  return err.code === '42703' || err.code === 'PGRST204' || /column/i.test(err.message ?? '')
}

export async function fetchAppointment(id: string): Promise<Appointment | null> {
  const { data, error } = await getSupabase()
    .from('appointments')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as Appointment) ?? null
}

export async function cancelAppointment(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
  if (error) throw error
}

export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await getSupabase().from('appointments').delete().eq('id', id)
  if (error) throw error
}

// ── admin ────────────────────────────────────────────────────────────────────
export interface AppointmentWithStudent extends Appointment {
  student: Profile | null
}

export async function fetchAllAppointments(): Promise<AppointmentWithStudent[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .order('starts_at', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as Appointment[]
  const ids = [...new Set(rows.map((r) => r.student_id))]
  const byId = new Map<string, Profile>()
  if (ids.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('*')
      .in('id', ids)
    for (const p of (profs ?? []) as Profile[]) byId.set(p.id, p)
  }
  return rows.map((r) => ({ ...r, student: byId.get(r.student_id) ?? null }))
}

export async function setAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<void> {
  const { error } = await getSupabase()
    .from('appointments')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}
