/**
 * Admin: student imports, invites and performance data.
 *
 * Imports and (re)sending go through the `admin-invite-students` edge function
 * (it checks the caller is an admin and sends the e-mails). Lists, revoking and
 * performance reads use RLS-protected tables / admin-only RPCs directly.
 */

import { getSupabase } from '@/lib/supabase/client'
import type { ImportFormat, PreviewRow } from '@/lib/student-import'
import { MIME_BY_FORMAT } from '@/lib/student-import'
import { berlinDay } from '@/lib/performance'

export type InviteStatus = 'pending' | 'sent' | 'failed' | 'accepted' | 'revoked'
export type MailResult = 'sent' | 'failed' | 'skipped' | 'throttled' | 'not_configured' | 'disabled' | 'queued'
export type RowOutcome = 'invite_new' | 'invite_update' | 'registered' | 'skipped'

export interface Invite {
  id: string
  import_id: string | null
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  student_code: string
  code_source: 'file' | 'generated' | 'profile'
  status: InviteStatus
  send_count: number
  last_sent_at: string | null
  last_error: string | null
  accepted_at: string | null
  profile_id: string | null
  created_at: string
  /** From Resend's webhook (after the hardening migration). */
  delivery_status?: 'delivered' | 'bounced' | 'complained' | 'delayed' | null
}

export interface ImportResultRow {
  row: number
  email: string
  first_name: string | null
  last_name: string | null
  student_code: string | null
  code_source: string | null
  outcome: RowOutcome
  reason: string | null
  invite_id: string | null
  mail: MailResult | null
}

export interface ImportSummary {
  total_rows: number
  invited: number
  already_registered: number
  skipped: number
  emails_sent: number
  emails_failed: number
}

export interface StudentImport extends ImportSummary {
  id: string
  file_name: string
  file_format: ImportFormat
  file_path: string | null
  created_at: string
  created_by: string | null
  rows?: ImportResultRow[]
}

/** Thrown with the edge function's error code (e.g. 'forbidden', 'too_many_rows'). */
export class InviteApiError extends Error {}

/** Missing table / function = the backend update isn't deployed yet. */
export function isNotDeployed(e: any): boolean {
  const msg = `${e?.code ?? ''} ${e?.message ?? ''}`.toLowerCase()
  return (
    msg.includes('42p01') || // undefined_table
    msg.includes('42883') || // undefined_function
    msg.includes('pgrst202') || // function not in schema cache
    msg.includes('pgrst205') || // table not in schema cache
    msg.includes('could not find') ||
    msg.includes('not_found') ||
    msg.includes('function not found') ||
    msg.includes('404')
  )
}

/** UUID v4 for Idempotency-Key headers (crypto when available). */
export function newIdempotencyKey(): string {
  const b = new Uint8Array(16)
  const c = (globalThis as any).crypto
  if (c?.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Worth retrying: network failure, timeout, 429 or 5xx (never 4xx validation errors). */
export function isRetryable(status: number | null): boolean {
  return status === null || status === 408 || status === 429 || status >= 500
}

async function invoke<T>(body: Record<string, unknown>, opts: { idempotencyKey?: string; retries?: number } = {}): Promise<T> {
  const retries = opts.retries ?? 0
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await getSupabase().functions.invoke('admin-invite-students', {
      body,
      headers: opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : undefined,
    })
    if (!error) {
      if ((data as any)?.error) throw new InviteApiError((data as any).error)
      return data as T
    }
    let code: string = (error as any)?.message ?? 'error'
    let status: number | null = null
    try {
      const ctx = (error as any).context
      status = typeof ctx?.status === 'number' ? ctx.status : null
      if (status === 404) code = 'not_found'
      const parsed = ctx && typeof ctx.json === 'function' ? await ctx.json() : null
      if (parsed?.error) code = parsed.error
    } catch {
      /* body not JSON */
    }
    // Safe to repeat: the same Idempotency-Key makes the server return the first result.
    if (attempt < retries && isRetryable(status)) {
      await new Promise((r) => setTimeout(r, Math.random() * Math.min(8000, 1000 * 2 ** attempt)))
      continue
    }
    throw new InviteApiError(code)
  }
}

/** Invite text to copy / share by hand (WhatsApp, SMS) — same content as the e-mail. */
export function inviteText(i: Pick<Invite, 'first_name' | 'email' | 'student_code'>): string {
  return [
    `${i.first_name ? `Hallo ${i.first_name}, ` : ''}hier ist dein persönlicher Code für die App von Fahrschule Abgefahrn: ${i.student_code}`,
    '',
    'iPhone: https://apps.apple.com/de/app/fahrschule-abgefahrn/id6827141269',
    'Android: https://play.google.com/store/apps/details?id=de.fahrschuleabgefahrn.app',
    '',
    `In der App „Registrieren“ antippen und mit ${i.email} und dem Code ein Konto anlegen.`,
  ].join('\n')
}

// ── import ──────────────────────────────────────────────────────────────────

/** Keeps the original file in the private `student-imports` bucket. Returns its path or null. */
export async function storeImportFile(
  fileName: string,
  format: Exclude<ImportFormat, 'paste'>,
  data: Uint8Array | Blob,
): Promise<string | null> {
  const safe = fileName.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '').slice(-120) || `liste.${format}`
  const stamp = berlinDay(new Date())
  const path = `imports/${stamp}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
  const { error } = await getSupabase()
    .storage.from('student-imports')
    .upload(path, data as any, { contentType: MIME_BY_FORMAT[format], upsert: false })
  return error ? null : path
}

export async function importStudents(input: {
  fileName: string
  format: ImportFormat
  filePath: string | null
  rows: PreviewRow[]
  send: boolean
  /** Same key for every retry of one import (see newIdempotencyKey). */
  idempotencyKey: string
}): Promise<{ import_id: string; summary: ImportSummary; rows: ImportResultRow[]; mail_configured: boolean; replayed?: boolean }> {
  return invoke({
    action: 'import',
    file_name: input.fileName,
    file_format: input.format,
    file_path: input.filePath,
    send: input.send,
    rows: input.rows
      .filter((r) => !r.issue)
      .map((r) => ({
        row: r.row,
        email: r.email,
        first_name: r.first_name,
        last_name: r.last_name,
        phone: r.phone,
        student_code: r.student_code,
      })),
  }, { idempotencyKey: input.idempotencyKey, retries: 2 })
}

export async function sendInvites(
  ids: string[],
): Promise<{ results: Record<string, MailResult>; tally: Partial<Record<MailResult, number>>; mail_configured: boolean }> {
  return invoke({ action: 'send', invite_ids: ids })
}

// ── lists ───────────────────────────────────────────────────────────────────

const INVITE_COLS =
  'id,import_id,email,first_name,last_name,phone,student_code,code_source,status,send_count,last_sent_at,last_error,accepted_at,profile_id,created_at'

export async function fetchInvites(filter?: { importId?: string }): Promise<Invite[]> {
  const out: Invite[] = []
  for (let from = 0; ; from += 1000) {
    const query = (cols: string) => {
      let q = getSupabase().from('student_invites').select(cols).order('created_at', { ascending: false }).range(from, from + 999)
      if (filter?.importId) q = q.eq('import_id', filter.importId)
      return q
    }
    let { data, error } = (await query(`${INVITE_COLS},delivery_status`)) as any
    // Before the 2026-11-11 migration the column doesn't exist yet (42703) — degrade gracefully.
    if (error && String(error.code) === '42703') ({ data, error } = (await query(INVITE_COLS)) as any)
    if (error) throw error
    out.push(...((data ?? []) as Invite[]))
    if (!data || data.length < 1000) return out
  }
}

export async function revokeInvites(ids: string[]): Promise<void> {
  const { error } = await getSupabase()
    .from('student_invites')
    .update({ status: 'revoked' })
    .in('id', ids)
    .neq('status', 'accepted')
  if (error) throw error
}

export async function reopenInvites(ids: string[]): Promise<void> {
  const { error } = await getSupabase()
    .from('student_invites')
    .update({ status: 'pending', last_error: null })
    .in('id', ids)
    .eq('status', 'revoked')
  if (error) throw error
}

export async function fetchImports(): Promise<StudentImport[]> {
  const { data, error } = await getSupabase()
    .from('student_imports')
    .select('id,file_name,file_format,file_path,total_rows,invited,already_registered,skipped,emails_sent,emails_failed,created_at,created_by')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as StudentImport[]
}

export async function fetchImport(id: string): Promise<StudentImport | null> {
  const { data, error } = await getSupabase().from('student_imports').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as StudentImport) ?? null
}

/** Short-lived link to the original uploaded file. */
export async function importFileUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase().storage.from('student-imports').createSignedUrl(path, 600, { download: true })
  if (error) throw error
  return data.signedUrl
}

// ── performance ─────────────────────────────────────────────────────────────

export interface StudentPerformance {
  student_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  student_code: string | null
  is_active: boolean
  joined_at: string
  last_active_on: string | null
  streak_days: number
  topics_done: number
  topics_mastered: number
  quiz_rounds: number
  quiz_questions: number
  quiz_correct: number
  xp_total: number
  xp_week: number
  last_quiz_at: string | null
  driving_lessons: number
  lessons_completed: number
  lessons_upcoming: number
  drive_autobahn: boolean
  drive_night: boolean
  drive_overland: boolean
  theory_exam_date: string | null
  practical_exam_date: string | null
  theory_passed: boolean | null
  practical_passed: boolean | null
}

export interface TopicStat {
  topic_number: number
  rounds: number
  questions: number
  correct: number
  best_pct: number
  mastered: boolean
  last_at: string | null
}

export async function fetchPerformance(): Promise<StudentPerformance[]> {
  const { data, error } = await getSupabase().rpc('admin_student_performance')
  if (error) throw error
  return (data ?? []) as StudentPerformance[]
}

export async function fetchTopicStats(studentId: string): Promise<TopicStat[]> {
  const { data, error } = await getSupabase().rpc('admin_student_topic_stats', { p_student: studentId })
  if (error) throw error
  return (data ?? []) as TopicStat[]
}

export interface QuizAttemptRow {
  id: string
  topic_number: number
  total: number
  correct: number
  xp: number
  mastered: boolean
  duration_ms: number
  created_at: string
}

export async function fetchRecentAttempts(studentId: string, limit = 15): Promise<QuizAttemptRow[]> {
  const { data, error } = await getSupabase()
    .from('quiz_attempts')
    .select('id,topic_number,total,correct,xp,mastered,duration_ms,created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as QuizAttemptRow[]
}
