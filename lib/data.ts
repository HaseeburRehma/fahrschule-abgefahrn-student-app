/**
 * Typed data-access helpers over Supabase for the student-facing screens.
 * Admin queries live alongside their screens.
 */

import { getSupabase } from '@/lib/supabase/client'
import { cached, invalidateCache } from '@/lib/cache'
import type {
  Package,
  TheoryClass,
  TheoryTopic,
  Profile,
} from '@/lib/types'

export function fetchTheoryTopics(): Promise<TheoryTopic[]> {
  return cached('topics', 600000, () => _fetchTheoryTopics()).then((a) => [...a])
}

async function _fetchTheoryTopics(): Promise<TheoryTopic[]> {
  const { data, error } = await getSupabase()
    .from('theory_topics')
    .select('*')
    .order('number', { ascending: true })
  if (error) throw error
  return (data ?? []) as TheoryTopic[]
}

export async function fetchMyPackages(studentId: string): Promise<Package[]> {
  const { data, error } = await getSupabase()
    .from('student_packages')
    .select('packages(*)')
    .eq('student_id', studentId)
  if (error) throw error
  return ((data ?? []) as any[])
    .map((r) => r.packages as Package)
    .filter(Boolean)
    .sort((a, b) => a.sort - b.sort)
}

export async function fetchTopicById(
  id: string | null,
): Promise<TheoryTopic | null> {
  if (!id) return null
  const { data, error } = await getSupabase()
    .from('theory_topics')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as TheoryTopic) ?? null
}

/** Classes the student is enrolled in, newest-first not applied — caller sorts. */
export function fetchMyClasses(studentId: string): Promise<TheoryClass[]> {
  return cached(`classes:${studentId}`, 60000, () => _fetchMyClasses(studentId)).then((a) => [...a])
}

async function _fetchMyClasses(studentId: string): Promise<TheoryClass[]> {
  const { data, error } = await getSupabase()
    .from('class_enrollments')
    .select('theory_classes(*)')
    .eq('student_id', studentId)
  if (error) throw error
  return ((data ?? []) as any[])
    .map((r) => r.theory_classes as TheoryClass)
    .filter(Boolean)
}

export function splitByTime(classes: TheoryClass[], now = new Date()) {
  const upcoming: TheoryClass[] = []
  const past: TheoryClass[] = []
  for (const c of classes) {
    const t = new Date(c.ends_at ?? c.starts_at)
    if (t.getTime() >= now.getTime()) upcoming.push(c)
    else past.push(c)
  }
  upcoming.sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  )
  past.sort(
    (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
  )
  return { upcoming, past }
}

/** Update the signed-in user's own profile (RLS allows self-update; role/active
 * are protected by a DB trigger). */
export async function updateMyProfile(
  userId: string,
  patch: Partial<
    Pick<
      Profile,
      | 'first_name'
      | 'last_name'
      | 'phone'
      | 'locale'
      | 'driving_lessons_count'
      | 'drive_autobahn'
      | 'drive_night'
      | 'drive_overland'
      | 'theory_exam_date'
      | 'practical_exam_date'
      | 'theory_passed'
      | 'practical_passed'
      | 'birth_date'
    >
  >,
): Promise<void> {
  const { error } = await getSupabase()
    .from('profiles')
    .update(patch)
    .eq('id', userId)
  if (error) throw error
}

/** Permanently delete the signed-in user's own account via Edge Function. */
export async function deleteMyAccount(): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke('delete-account', {
    body: {},
  })
  if (error) {
    const msg = (data as any)?.error ?? error.message
    throw new Error(msg)
  }
  if ((data as any)?.error) throw new Error((data as any).error)
}

/** IDs of theory topics the student has marked as completed. */
export function fetchMyDoneTopics(userId: string): Promise<Set<string>> {
  return cached(`done:${userId}`, 60000, () => _fetchMyDoneTopics(userId)).then((s) => new Set(s))
}

async function _fetchMyDoneTopics(userId: string): Promise<Set<string>> {
  const { data, error } = await getSupabase()
    .from('topic_progress')
    .select('topic_id')
    .eq('student_id', userId)
  if (error) throw error
  return new Set((data ?? []).map((r: any) => r.topic_id as string))
}

export async function setTopicDone(
  userId: string,
  topicId: string,
  done: boolean,
): Promise<void> {
  invalidateCache('done:')
  const supabase = getSupabase()
  if (done) {
    const { error } = await supabase
      .from('topic_progress')
      .upsert(
        { student_id: userId, topic_id: topicId },
        { onConflict: 'student_id,topic_id', ignoreDuplicates: true },
      )
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('topic_progress')
      .delete()
      .eq('student_id', userId)
      .eq('topic_id', topicId)
    if (error) throw error
  }
}

export function displayName(p: Profile | null): string {
  if (!p) return ''
  const n = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return n || (p.email ?? '')
}
