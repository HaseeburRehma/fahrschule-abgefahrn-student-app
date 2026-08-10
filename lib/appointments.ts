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
}): Promise<Appointment> {
  const { data, error } = await getSupabase()
    .from('appointments')
    .insert({
      student_id: input.studentId,
      title: input.title,
      starts_at: input.starts_at,
      ends_at: input.ends_at ?? null,
      note: input.note ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Appointment
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
