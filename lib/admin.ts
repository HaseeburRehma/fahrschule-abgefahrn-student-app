/**
 * Admin data-access helpers. All of these rely on RLS: only an admin session
 * can read/write the rows here (student creation goes through an Edge Function
 * that verifies the caller and uses the service role).
 */

import { getSupabase } from '@/lib/supabase/client'
import type {
  Package,
  Profile,
  SignupIntake,
  TheoryClass,
  TheoryTopic,
} from '@/lib/types'

// ── students ────────────────────────────────────────────────────────────────
export async function fetchStudents(): Promise<Profile[]> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('role', 'student')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Profile[]
}

export interface StudentWithPlan {
  profile: Profile
  packages: Package[]
  topic: TheoryTopic | null
}

/** All students with their assigned packages + current theory topic (joined). */
export async function fetchStudentsWithPlans(): Promise<StudentWithPlan[]> {
  const supabase = getSupabase()
  const [students, sp, topics] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('created_at', { ascending: false }),
    supabase
      .from('student_packages')
      .select('student_id, packages(id,key,name_de,name_en,price_eur,sort)'),
    supabase.from('theory_topics').select('*'),
  ])
  if (students.error) throw students.error

  const topicById = new Map<string, TheoryTopic>(
    ((topics.data ?? []) as TheoryTopic[]).map((t) => [t.id, t]),
  )
  const pkgsByStudent = new Map<string, Package[]>()
  for (const row of (sp.data ?? []) as any[]) {
    const p = row.packages as Package
    if (!p) continue
    const arr = pkgsByStudent.get(row.student_id) ?? []
    arr.push(p)
    pkgsByStudent.set(row.student_id, arr)
  }

  return ((students.data ?? []) as Profile[]).map((pr) => ({
    profile: pr,
    packages: (pkgsByStudent.get(pr.id) ?? []).sort((a, b) => a.sort - b.sort),
    topic: pr.current_theory_topic_id
      ? topicById.get(pr.current_theory_topic_id) ?? null
      : null,
  }))
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as Profile) ?? null
}

export interface NewStudentInput {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  current_theory_topic_id?: string | null
  package_ids?: string[]
}

/** Creates the auth user + profile via the admin-create-student Edge Function. */
export async function createStudent(input: NewStudentInput): Promise<{ id: string }> {
  const { data, error } = await getSupabase().functions.invoke(
    'admin-create-student',
    { body: input },
  )
  if (error) {
    // Surface the function's JSON error message when present.
    const msg = (data as any)?.error ?? error.message
    throw new Error(msg)
  }
  if ((data as any)?.error) throw new Error((data as any).error)
  return data as { id: string }
}

/** Permanently deletes a student (auth user + all their data) via Edge Function. */
export async function deleteStudent(id: string): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke(
    'admin-delete-student',
    { body: { id } },
  )
  if (error) {
    const msg = (data as any)?.error ?? error.message
    throw new Error(msg)
  }
  if ((data as any)?.error) throw new Error((data as any).error)
}

export async function updateStudent(
  id: string,
  patch: Partial<
    Pick<
      Profile,
      'first_name' | 'last_name' | 'phone' | 'is_active' | 'current_theory_topic_id'
    >
  >,
): Promise<void> {
  const { error } = await getSupabase().from('profiles').update(patch).eq('id', id)
  if (error) throw error
}

// ── package assignment ──────────────────────────────────────────────────────
export async function fetchPackages(): Promise<Package[]> {
  const { data, error } = await getSupabase()
    .from('packages')
    .select('*')
    .order('sort', { ascending: true })
  if (error) throw error
  return (data ?? []) as Package[]
}

export async function fetchStudentPackageIds(studentId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from('student_packages')
    .select('package_id')
    .eq('student_id', studentId)
  if (error) throw error
  return (data ?? []).map((r: any) => r.package_id as string)
}

/** Replaces the student's package set with exactly `packageIds`. */
export async function setStudentPackages(
  studentId: string,
  packageIds: string[],
): Promise<void> {
  const supabase = getSupabase()
  const { error: delErr } = await supabase
    .from('student_packages')
    .delete()
    .eq('student_id', studentId)
  if (delErr) throw delErr
  if (packageIds.length) {
    const rows = packageIds.map((pid) => ({
      student_id: studentId,
      package_id: pid,
    }))
    const { error: insErr } = await supabase.from('student_packages').insert(rows)
    if (insErr) throw insErr
  }
}

// ── theory topics / classes ─────────────────────────────────────────────────
export async function fetchTopics(): Promise<TheoryTopic[]> {
  const { data, error } = await getSupabase()
    .from('theory_topics')
    .select('*')
    .order('number', { ascending: true })
  if (error) throw error
  return (data ?? []) as TheoryTopic[]
}

export async function fetchClasses(): Promise<TheoryClass[]> {
  const { data, error } = await getSupabase()
    .from('theory_classes')
    .select('*')
    .order('starts_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as TheoryClass[]
}

export async function createClass(input: {
  title_de: string
  title_en: string
  starts_at: string
  ends_at?: string | null
  location?: string | null
  topic_id?: string | null
  notes?: string | null
}): Promise<void> {
  const { error } = await getSupabase().from('theory_classes').insert(input)
  if (error) throw error
}

export async function fetchClassEnrollmentIds(classId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from('class_enrollments')
    .select('student_id')
    .eq('class_id', classId)
  if (error) throw error
  return (data ?? []).map((r: any) => r.student_id as string)
}

export async function updateClass(
  id: string,
  patch: Partial<{
    title_de: string
    title_en: string
    starts_at: string
    ends_at: string | null
    location: string | null
    topic_id: string | null
    notes: string | null
  }>,
): Promise<void> {
  const { error } = await getSupabase()
    .from('theory_classes')
    .update(patch)
    .eq('id', id)
  if (error) throw error
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('theory_classes')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export interface AdminStats {
  students: number
  pendingIntake: number
  upcomingClasses: number
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const supabase = getSupabase()
  const nowIso = new Date().toISOString()
  const [students, intake, classes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'student'),
    supabase
      .from('signup_intake')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('theory_classes')
      .select('id', { count: 'exact', head: true })
      .gte('starts_at', nowIso),
  ])
  return {
    students: students.count ?? 0,
    pendingIntake: intake.count ?? 0,
    upcomingClasses: classes.count ?? 0,
  }
}

export async function enrollStudent(
  studentId: string,
  classId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('class_enrollments')
    .upsert({ student_id: studentId, class_id: classId })
  if (error) throw error
}

export async function unenrollStudent(
  studentId: string,
  classId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('class_enrollments')
    .delete()
    .eq('student_id', studentId)
    .eq('class_id', classId)
  if (error) throw error
}

export async function fetchClass(id: string): Promise<TheoryClass | null> {
  const { data, error } = await getSupabase()
    .from('theory_classes')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as TheoryClass) ?? null
}

// ── notifications ───────────────────────────────────────────────────────────
export interface OutgoingNotification {
  title: string
  body?: string
  type?: string
  data?: Record<string, unknown>
}

/** Inserts one notification row per recipient (triggers push per row). */
export async function sendNotification(
  recipientIds: string[],
  n: OutgoingNotification,
): Promise<number> {
  if (!recipientIds.length) return 0
  const rows = recipientIds.map((uid) => ({
    user_id: uid,
    title: n.title,
    body: n.body ?? null,
    type: n.type ?? 'general',
    data: n.data ?? null,
  }))
  const { error } = await getSupabase().from('notifications').insert(rows)
  if (error) throw error
  return rows.length
}

// ── intake ──────────────────────────────────────────────────────────────────
export async function fetchIntake(
  status: 'pending' | 'converted' | 'dismissed' = 'pending',
): Promise<SignupIntake[]> {
  const { data, error } = await getSupabase()
    .from('signup_intake')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SignupIntake[]
}

export async function setIntakeStatus(
  id: string,
  status: 'pending' | 'converted' | 'dismissed',
): Promise<void> {
  const { error } = await getSupabase()
    .from('signup_intake')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}
