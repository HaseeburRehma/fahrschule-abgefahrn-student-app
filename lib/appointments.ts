import { getSupabase } from '@/lib/supabase/client'
import { cached, invalidateCache } from '@/lib/cache'
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

export function fetchMyAppointments(
  studentId: string,
): Promise<Appointment[]> {
  return cached(`appts:${studentId}`, 15000, () => _fetchMyAppointments(studentId)).then((a) => [...a])
}

async function _fetchMyAppointments(
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
  invalidateCache('appts:')
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
  invalidateCache('appts:')
  const { error } = await getSupabase()
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
  if (error) throw error
}

/**
 * Student cancel: the only change a student may make to a booked lesson
 * (RLS forbids edits and deletes of confirmed appointments). Reads the row back
 * so an RLS-filtered no-op surfaces as an error instead of a silent "success".
 */
export async function cancelMyAppointment(id: string): Promise<void> {
  invalidateCache('appts:')
  const { data, error } = await getSupabase()
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select('id, status')
  if (error) throw error
  if (!data || !(data as any[]).length) {
    throw Object.assign(new Error('not allowed'), { code: '42501' })
  }
}

export async function deleteAppointment(id: string): Promise<void> {
  invalidateCache('appts:')
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
  invalidateCache('appts:')
  const { error } = await getSupabase()
    .from('appointments')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

// ── admin: lesson details (v2) ───────────────────────────────────────────────
export const LESSON_TYPES = ['regular', 'autobahn', 'night', 'overland', 'exam_prep'] as const
export type AppointmentLessonType = (typeof LESSON_TYPES)[number]

/** Fields an admin may set when creating, confirming or editing an appointment. */
export interface AppointmentDetailsPatch {
  title?: string
  starts_at?: string
  ends_at?: string | null
  note?: string | null
  status?: AppointmentStatus
  instructor_name?: string | null
  meeting_point?: string | null
  lesson_type?: AppointmentLessonType | null
}

/** Admin edit (date/time, lesson details, optionally status) in a single update. */
export async function updateAppointment(
  id: string,
  patch: AppointmentDetailsPatch,
): Promise<Appointment> {
  invalidateCache('appts:')
  const { data, error } = await getSupabase()
    .from('appointments')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Appointment
}

/** Admin creates an appointment for a student — confirmed right away. */
export async function adminCreateAppointment(
  input: { studentId: string; title: string; starts_at: string } & Omit<
    AppointmentDetailsPatch,
    'title' | 'starts_at'
  >,
): Promise<Appointment> {
  invalidateCache('appts:')
  const { studentId, ...rest } = input
  const { data, error } = await getSupabase()
    .from('appointments')
    .insert({ status: 'confirmed', ...rest, student_id: studentId })
    .select('*')
    .single()
  if (error) throw error
  return data as Appointment
}
