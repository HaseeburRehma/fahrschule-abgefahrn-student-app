// @ts-nocheck  — Deno edge function (Deno global + https: imports). Checked by
// the Deno runtime at deploy, not by the app's TypeScript.
// ============================================================================
// admin-invite-students — bulk import + e-mail invites (admins only).
//
//   POST { action: 'import', file_name, file_format, file_path?, rows: [...], send }
//        Plans every row (see _shared/invites.ts → planImport), writes the
//        invites, adopts file codes for students who already have an account,
//        stores the import with its per-row outcome and — with send=true —
//        e-mails every new / reopened invite.
//   POST { action: 'send', invite_ids: [...] }
//        (Re)sends invites. Accepted / revoked ones and ones sent < 60 s ago are skipped.
//
// E-mail goes through Resend. Secrets (Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY   required to send
//   MAIL_FROM        e.g. "Fahrschule Abgefahrn <app@fahrschule-abgefahrn.de>"
//                    (domain must be verified in Resend)
//   MAIL_REPLY_TO    optional, e.g. info@fahrschule-abgefahrn.de
//   APP_WEB_URL      optional link to the web app
// Without RESEND_API_KEY / MAIL_FROM the invites are still saved (status
// pending) and the response says mail_configured: false.
//
// Deploy:  supabase functions deploy admin-invite-students
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  MAX_IMPORT_ROWS,
  MAX_SEND_PER_CALL,
  buildInviteEmail,
  normalizeEmail,
  planImport,
} from '../_shared/invites.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SCHOOL = {
  name: 'Fahrschule Abgefahrn',
  appStoreUrl: 'https://apps.apple.com/de/app/fahrschule-abgefahrn/id6827141269',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=de.fahrschuleabgefahrn.app',
}

const FORMATS = new Set(['xlsx', 'ods', 'csv', 'tsv', 'txt', 'paste'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RESEND_COOLDOWN_MS = 60_000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const str = (v: unknown, max: number) => (v == null ? null : String(v).slice(0, max))

/** PostgREST caps responses at 1000 rows — page through everything. */
async function fetchAll(make: (from: number, to: number) => any): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── e-mail ──────────────────────────────────────────────────────────────────

interface InviteRow {
  id: string
  email: string
  first_name: string | null
  student_code: string
  status: string
  send_count: number
  last_sent_at: string | null
}

type MailResult = 'sent' | 'failed' | 'skipped' | 'throttled' | 'not_configured'

async function sendInvites(admin: any, invites: InviteRow[]): Promise<Map<string, MailResult>> {
  const result = new Map<string, MailResult>()
  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('MAIL_FROM')
  const replyTo = Deno.env.get('MAIL_REPLY_TO') || undefined
  const webUrl = Deno.env.get('APP_WEB_URL') || null
  const now = Date.now()

  const due: InviteRow[] = []
  for (const inv of invites) {
    if (inv.status === 'accepted' || inv.status === 'revoked') result.set(inv.id, 'skipped')
    else if (inv.last_sent_at && now - new Date(inv.last_sent_at).getTime() < RESEND_COOLDOWN_MS)
      result.set(inv.id, 'throttled')
    else due.push(inv)
  }
  if (!due.length) return result
  if (!key || !from) {
    for (const inv of due) result.set(inv.id, 'not_configured')
    await admin
      .from('student_invites')
      .update({ last_error: 'mail_not_configured' })
      .in('id', due.map((d) => d.id))
    return result
  }

  for (const [i, batch] of chunks(due, 100).entries()) {
    if (i > 0) await sleep(600) // Resend default limit: 2 requests / second
    const payload = batch.map((inv) => {
      const mail = buildInviteEmail({
        email: inv.email,
        firstName: inv.first_name,
        code: inv.student_code,
        schoolName: SCHOOL.name,
        appStoreUrl: SCHOOL.appStoreUrl,
        playStoreUrl: SCHOOL.playStoreUrl,
        webUrl,
        supportEmail: replyTo ?? null,
      })
      return { from, to: [inv.email], subject: mail.subject, html: mail.html, text: mail.text, ...(replyTo ? { reply_to: replyTo } : {}) }
    })
    let ok = false
    let errText = ''
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      ok = res.ok
      if (!ok) errText = `resend_${res.status}: ${(await res.text()).slice(0, 300)}`
    } catch (e) {
      errText = `resend_unreachable: ${String(e?.message ?? e).slice(0, 300)}`
    }
    const stamp = new Date().toISOString()
    const updates = batch.map((inv) => ({
      id: inv.id,
      email: inv.email,
      student_code: inv.student_code,
      status: ok ? 'sent' : 'failed',
      send_count: ok ? (inv.send_count ?? 0) + 1 : inv.send_count ?? 0,
      last_sent_at: ok ? stamp : inv.last_sent_at,
      last_error: ok ? null : errText.slice(0, 500),
    }))
    const { error } = await admin.from('student_invites').upsert(updates, { onConflict: 'id' })
    if (error) console.error('invite status update failed', error.message)
    for (const inv of batch) result.set(inv.id, ok ? 'sent' : 'failed')
  }
  return result
}

// ── import ──────────────────────────────────────────────────────────────────

async function handleImport(admin: any, callerId: string, body: any) {
  const fileName = str(body.file_name, 255)?.trim()
  const format = String(body.file_format ?? '')
  const filePath = body.file_path == null ? null : String(body.file_path)
  if (!fileName || !FORMATS.has(format)) return json({ error: 'invalid_input' }, 400)
  if (filePath && (!/^imports\/[A-Za-z0-9._/-]{1,480}$/.test(filePath) || filePath.includes('..')))
    return json({ error: 'invalid_input' }, 400)
  if (!Array.isArray(body.rows) || body.rows.length === 0) return json({ error: 'no_rows' }, 400)
  if (body.rows.length > MAX_IMPORT_ROWS) return json({ error: 'too_many_rows', max: MAX_IMPORT_ROWS }, 400)

  const rows = body.rows.map((r: any, i: number) => ({
    row: Number.isInteger(r?.row) && r.row > 0 && r.row < 1_000_000 ? r.row : i + 1,
    email: str(r?.email, 320) ?? '',
    first_name: str(r?.first_name, 200),
    last_name: str(r?.last_name, 200),
    phone: str(r?.phone, 100),
    student_code: str(r?.student_code, 100),
  }))

  // Current state.
  const [profiles, invites, setting] = await Promise.all([
    fetchAll((a, b) => admin.from('profiles').select('id,email,student_code,role').order('id').range(a, b)),
    fetchAll((a, b) =>
      admin.from('student_invites').select('id,email,first_name,last_name,phone,student_code,status').order('id').range(a, b),
    ),
    admin.from('app_settings').select('value').eq('key', 'signup_code').maybeSingle(),
  ])
  const profilesByEmail = new Map()
  const invitesByEmail = new Map()
  const codeOwners = new Map<string, string>()
  for (const p of profiles) {
    const email = normalizeEmail(p.email)
    if (email) profilesByEmail.set(email, p)
    if (p.student_code) codeOwners.set(p.student_code, email)
  }
  for (const inv of invites) {
    invitesByEmail.set(inv.email, inv)
    if (!codeOwners.has(inv.student_code)) codeOwners.set(inv.student_code, inv.email)
  }

  const plan = planImport(rows, { profilesByEmail, invitesByEmail, codeOwners, schoolCode: setting.data?.value ?? null }, randomBytes)

  // Import record first, so invites can point at it.
  const { data: imp, error: impErr } = await admin
    .from('student_imports')
    .insert({ file_name: fileName, file_format: format, file_path: filePath, total_rows: rows.length, created_by: callerId })
    .select('id')
    .single()
  if (impErr) return json({ error: impErr.message }, 500)

  // Invites: new + reopened, one upsert per 500 rows (keyed by e-mail).
  const inviteRows = plan.filter((p) => p.outcome === 'invite_new' || p.outcome === 'invite_update')
  const upserts = inviteRows.map((p) => {
    const prev = invitesByEmail.get(p.email)
    const reopen = !prev || ['accepted', 'revoked', 'failed'].includes(prev.status)
    return {
      email: p.email,
      first_name: p.first_name ?? prev?.first_name ?? null,
      last_name: p.last_name ?? prev?.last_name ?? null,
      phone: p.phone ?? prev?.phone ?? null,
      student_code: p.student_code,
      code_source: p.code_source === 'file' ? 'file' : 'generated',
      status: reopen ? 'pending' : prev.status,
      accepted_at: null,
      profile_id: null,
      import_id: imp.id,
      created_by: callerId,
    }
  })
  const failedEmails = new Set<string>()
  for (const part of chunks(upserts, 500)) {
    const { error } = await admin.from('student_invites').upsert(part, { onConflict: 'email' })
    if (!error) continue
    // A code collided (e.g. a parallel import) — retry row by row to keep the rest.
    for (const one of part) {
      const { error: e1 } = await admin.from('student_invites').upsert(one, { onConflict: 'email' })
      if (e1) failedEmails.add(one.email)
    }
  }
  for (const p of plan) {
    if (failedEmails.has(p.email)) {
      p.outcome = 'skipped'
      p.reason = 'code_taken'
    }
  }

  // Registered students: adopt the code from the file.
  for (const p of plan) {
    if (p.outcome !== 'registered' || p.reason !== 'code_updated') continue
    const { error } = await admin.from('profiles').update({ student_code: p.student_code }).eq('id', p.target_id)
    if (error) {
      p.reason = 'code_taken'
      p.student_code = profilesByEmail.get(p.email)?.student_code ?? null
    }
  }

  // Send.
  let mail = new Map<string, MailResult>()
  const mailConfigured = Boolean(Deno.env.get('RESEND_API_KEY') && Deno.env.get('MAIL_FROM'))
  const invitedEmails = plan.filter((p) => p.outcome === 'invite_new' || p.outcome === 'invite_update').map((p) => p.email)
  const idByEmail = new Map<string, string>()
  if (invitedEmails.length) {
    const saved = []
    for (const part of chunks(invitedEmails, 300)) {
      const { data, error } = await admin
        .from('student_invites')
        .select('id,email,first_name,student_code,status,send_count,last_sent_at')
        .in('email', part)
      if (error) return json({ error: error.message }, 500)
      saved.push(...(data ?? []))
    }
    for (const s of saved) idByEmail.set(s.email, s.id)
    if (body.send === true) mail = await sendInvites(admin, saved)
  }

  const resultRows = plan.map((p) => {
    const id = idByEmail.get(p.email) ?? null
    return {
      row: p.row,
      email: p.email,
      first_name: p.first_name,
      last_name: p.last_name,
      student_code: p.student_code,
      code_source: p.code_source,
      outcome: p.outcome,
      reason: p.reason,
      invite_id: id,
      mail: id ? mail.get(id) ?? null : null,
    }
  })
  const count = (f: (r: any) => boolean) => resultRows.filter(f).length
  const summary = {
    total_rows: rows.length,
    invited: count((r) => r.outcome === 'invite_new' || r.outcome === 'invite_update'),
    already_registered: count((r) => r.outcome === 'registered'),
    skipped: count((r) => r.outcome === 'skipped'),
    emails_sent: count((r) => r.mail === 'sent'),
    emails_failed: count((r) => r.mail === 'failed'),
  }
  const { error: updErr } = await admin.from('student_imports').update({ ...summary, rows: resultRows }).eq('id', imp.id)
  if (updErr) console.error('import summary update failed', updErr.message)

  return json({ import_id: imp.id, summary, rows: resultRows, mail_configured: mailConfigured })
}

async function handleSend(admin: any, body: any) {
  const ids: string[] = Array.isArray(body.invite_ids) ? body.invite_ids.filter((x: unknown) => typeof x === 'string' && UUID_RE.test(x)) : []
  if (!ids.length) return json({ error: 'invalid_input' }, 400)
  if (ids.length > MAX_SEND_PER_CALL) return json({ error: 'too_many', max: MAX_SEND_PER_CALL }, 400)
  const rows: InviteRow[] = []
  for (const part of chunks([...new Set(ids)], 300)) {
    const { data, error } = await admin
      .from('student_invites')
      .select('id,email,first_name,student_code,status,send_count,last_sent_at')
      .in('id', part)
    if (error) return json({ error: error.message }, 500)
    rows.push(...(data ?? []))
  }
  const result = await sendInvites(admin, rows)
  const tally: Record<string, number> = {}
  for (const v of result.values()) tally[v] = (tally[v] ?? 0) + 1
  return json({
    results: Object.fromEntries(result),
    tally,
    mail_configured: Boolean(Deno.env.get('RESEND_API_KEY') && Deno.env.get('MAIL_FROM')),
  })
}

// ── entry ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (Number(req.headers.get('content-length') ?? 0) > 3_000_000) return json({ error: 'too_large' }, 413)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'missing_authorization' }, 401)
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userRes } = await caller.auth.getUser()
  if (!userRes?.user) return json({ error: 'unauthenticated' }, 401)
  const { data: isAdmin, error: adminErr } = await caller.rpc('is_admin')
  if (adminErr) return json({ error: 'auth_check_failed' }, 500)
  if (!isAdmin) return json({ error: 'forbidden' }, 403)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const admin = createClient(url, serviceKey)
  try {
    if (body?.action === 'import') return await handleImport(admin, userRes.user.id, body)
    if (body?.action === 'send') return await handleSend(admin, body)
    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    console.error('admin-invite-students failed', e)
    return json({ error: 'server_error' }, 500)
  }
})
