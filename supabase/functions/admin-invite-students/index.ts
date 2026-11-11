// @ts-nocheck  — Deno edge function. Checked by `deno check` in CI.
// ============================================================================
// admin-invite-students — bulk import + e-mail invites.
//
//   POST { action: 'import', file_name, file_format, file_path?, rows: [...], send }
//        Header Idempotency-Key: <uuid> (or body.idempotency_key) — a retried or
//        double-tapped import returns the first result instead of importing twice.
//   POST { action: 'send', invite_ids: [...] }
//        (Re)sends invites. Accepted / revoked ones and ones sent < 60 s ago are skipped.
//   POST { action: 'retry' }  + header x-cron-secret (checked against Vault via verify_worker_secret)
//        Background worker (pg_cron → pg_net): re-sends failed invites whose
//        next_attempt_at is due (exponential backoff, max 5 attempts, bounced
//        addresses are never retried).
//
// Auth: admin JWT + public.is_admin() (RBAC) for import/send; CRON_SECRET for retry.
// Limits: 2,000 rows / import, 500 invites / send, 30 imports + 120 sends per admin per hour.
// Feature flags (app_settings): feature.student_import, feature.invite_emails.
//
// E-mail goes through Resend (batch API, ≤ 100 per request, Idempotency-Key per
// batch so a retried request never sends twice). Timeouts + retries with
// exponential backoff on 429/5xx; a circuit breaker stops hammering Resend
// while it is down — those invites go to the retry queue instead.
//
// Secrets: RESEND_API_KEY, MAIL_FROM (verified domain), MAIL_REPLY_TO?, APP_WEB_URL?,
//          CRON_SECRET optional (the retry worker's secret normally lives in Vault).
// Deploy:  supabase functions deploy admin-invite-students
// ============================================================================

import {
  CircuitBreaker,
  HttpError,
  badRequest,
  conflict,
  fetchWithRetry,
  forbidden,
  isUuid,
  readJson,
  sleep,
  timingSafeEqual,
  unauthorized,
} from '../_shared/http.ts'
import { MAX_IMPORT_ROWS, MAX_SEND_PER_CALL, buildInviteEmail, normalizeEmail, planImport } from '../_shared/invites.ts'
import { type Ctx, enforceRateLimit, requireAdmin, serve, serviceClient } from '../_shared/serve.ts'

const SCHOOL = {
  name: 'Fahrschule Abgefahrn',
  appStoreUrl: 'https://apps.apple.com/de/app/fahrschule-abgefahrn/id6827141269',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=de.fahrschuleabgefahrn.app',
}

const FORMATS = new Set(['xlsx', 'ods', 'csv', 'tsv', 'txt', 'paste'])
const RESEND_COOLDOWN_MS = 60_000
const MAX_ATTEMPTS = 5
const MAX_BODY_BYTES = 3_000_000

// One breaker per function instance: 3 failed Resend batches in a row → stop
// calling Resend for 60 s; affected invites are queued for the retry worker.
const resendBreaker = new CircuitBreaker('resend', 3, 60_000)

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))
const str = (v: unknown, max: number) => (v == null ? null : String(v).slice(0, max))

/** Next retry time: 5 min · 2^attempt, capped at 6 h, ±20 % jitter. */
export function nextAttemptAt(attempts: number, now = Date.now()): string {
  const base = Math.min(6 * 3600_000, 5 * 60_000 * 2 ** attempts)
  return new Date(now + base * (0.8 + Math.random() * 0.4)).toISOString()
}

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

async function flags(db: any): Promise<Record<string, boolean>> {
  const { data } = await db.from('app_settings').select('key,value').like('key', 'feature.%')
  const out: Record<string, boolean> = {}
  for (const r of data ?? []) out[r.key.slice(8)] = r.value === 'on'
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
  attempts?: number
  delivery_status?: string | null
}

type MailResult = 'sent' | 'failed' | 'skipped' | 'throttled' | 'not_configured' | 'disabled' | 'queued'
const INVITE_COLS = 'id,email,first_name,student_code,status,send_count,last_sent_at,attempts,delivery_status'

async function sendInvites(ctx: Ctx, db: any, invites: InviteRow[], opts: { ignoreCooldown?: boolean } = {}): Promise<Map<string, MailResult>> {
  const { log } = ctx
  const result = new Map<string, MailResult>()
  const key = ctx.env('RESEND_API_KEY')
  const from = ctx.env('MAIL_FROM')
  const replyTo = ctx.env('MAIL_REPLY_TO') || undefined
  const webUrl = ctx.env('APP_WEB_URL') || null
  const now = Date.now()

  const due: InviteRow[] = []
  for (const inv of invites) {
    if (inv.status === 'accepted' || inv.status === 'revoked' || inv.delivery_status === 'bounced' || inv.delivery_status === 'complained')
      result.set(inv.id, 'skipped')
    else if (!opts.ignoreCooldown && inv.last_sent_at && now - new Date(inv.last_sent_at).getTime() < RESEND_COOLDOWN_MS)
      result.set(inv.id, 'throttled')
    else due.push(inv)
  }
  if (!due.length) return result

  if (!(await flags(db)).invite_emails) {
    for (const inv of due) result.set(inv.id, 'disabled')
    return result
  }
  if (!key || !from) {
    for (const inv of due) result.set(inv.id, 'not_configured')
    await db.from('student_invites').update({ last_error: 'mail_not_configured' }).in('id', due.map((d) => d.id))
    return result
  }

  for (const [i, batch] of chunks(due, 100).entries()) {
    if (i > 0) await sleep(600) // Resend default limit: 2 requests / second
    const stamp = new Date().toISOString()

    if (!resendBreaker.canRequest()) {
      // Fail fast — queue for the background retry instead of waiting on timeouts.
      await db.from('student_invites').upsert(
        batch.map((inv) => ({
          id: inv.id, email: inv.email, student_code: inv.student_code, status: 'failed',
          last_error: 'provider_unavailable', next_attempt_at: nextAttemptAt(inv.attempts ?? 0),
        })),
        { onConflict: 'id' },
      )
      for (const inv of batch) result.set(inv.id, 'queued')
      continue
    }

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
    let ids: (string | null)[] = []
    try {
      const res = await fetchWithRetry(
        'https://api.resend.com/emails/batch',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            // Same key on every retry of this batch → Resend sends it only once.
            'Idempotency-Key': `${log.requestId}-${i}`,
          },
          body: JSON.stringify(payload),
        },
        { retries: 3, timeoutMs: 15_000, onRetry: (r) => log.warn('resend retry', r) },
      )
      ok = res.ok
      if (ok) {
        const json = await res.json().catch(() => null)
        ids = Array.isArray(json?.data) ? json.data.map((d: any) => (typeof d?.id === 'string' ? d.id : null)) : []
      } else errText = `resend_${res.status}: ${(await res.text()).slice(0, 300)}`
    } catch (e) {
      errText = `resend_unreachable: ${String(e?.message ?? e).slice(0, 300)}`
    }
    if (ok) resendBreaker.success()
    else {
      resendBreaker.failure()
      log.error('resend batch failed', { batch: i, size: batch.length, error: errText, breaker: resendBreaker.state })
    }

    const updates = batch.map((inv, j) => ({
      id: inv.id,
      email: inv.email,
      student_code: inv.student_code,
      status: ok ? 'sent' : 'failed',
      send_count: ok ? (inv.send_count ?? 0) + 1 : inv.send_count ?? 0,
      last_sent_at: ok ? stamp : inv.last_sent_at,
      last_error: ok ? null : errText.slice(0, 500),
      provider_message_id: ok ? ids[j] ?? null : null,
      delivery_status: null,
      attempts: ok ? 0 : (inv.attempts ?? 0) + 1,
      next_attempt_at: ok || (inv.attempts ?? 0) + 1 >= MAX_ATTEMPTS ? null : nextAttemptAt(inv.attempts ?? 0),
    }))
    const { error } = await db.from('student_invites').upsert(updates, { onConflict: 'id' })
    if (error) log.error('invite status update failed', { error: error.message })
    for (const inv of batch) result.set(inv.id, ok ? 'sent' : 'failed')
  }
  return result
}

// ── import ──────────────────────────────────────────────────────────────────

async function handleImport(ctx: Ctx, db: any, callerId: string, body: any) {
  if (!(await flags(db)).student_import) throw forbidden('feature_disabled')

  const fileName = str(body.file_name, 255)?.trim()
  const format = String(body.file_format ?? '')
  const filePath = body.file_path == null ? null : String(body.file_path)
  if (!fileName || !FORMATS.has(format)) throw badRequest('invalid_input')
  // Path traversal: only our own upload prefix, no "..", safe characters.
  if (filePath && (!/^imports\/[A-Za-z0-9._/-]{1,480}$/.test(filePath) || filePath.includes('..'))) throw badRequest('invalid_file_path')
  if (!Array.isArray(body.rows) || body.rows.length === 0) throw badRequest('no_rows')
  if (body.rows.length > MAX_IMPORT_ROWS) throw badRequest('too_many_rows', { max: MAX_IMPORT_ROWS })

  // Idempotency.
  const idemKey = ctx.req.headers.get('idempotency-key') ?? body.idempotency_key ?? null
  if (idemKey !== null && !isUuid(idemKey)) throw badRequest('invalid_idempotency_key')
  if (idemKey) {
    const { data: prior } = await db
      .from('student_imports')
      .select('id,completed_at,total_rows,invited,already_registered,skipped,emails_sent,emails_failed,rows')
      .eq('created_by', callerId)
      .eq('idempotency_key', idemKey)
      .maybeSingle()
    if (prior) {
      if (!prior.completed_at) throw conflict('import_in_progress')
      ctx.log.info('idempotent replay', { import_id: prior.id })
      const { id, completed_at: _done, rows, ...summary } = prior
      return ctx.json({ import_id: id, summary, rows: rows ?? [], mail_configured: Boolean(ctx.env('RESEND_API_KEY') && ctx.env('MAIL_FROM')), replayed: true })
    }
  }

  const rows = body.rows.map((r: any, i: number) => ({
    row: Number.isInteger(r?.row) && r.row > 0 && r.row < 1_000_000 ? r.row : i + 1,
    email: str(r?.email, 320) ?? '',
    first_name: str(r?.first_name, 200),
    last_name: str(r?.last_name, 200),
    phone: str(r?.phone, 100),
    student_code: str(r?.student_code, 100),
  }))

  // Record first (claims the idempotency key — a parallel duplicate hits the unique index).
  const { data: imp, error: impErr } = await db
    .from('student_imports')
    .insert({ file_name: fileName, file_format: format, file_path: filePath, total_rows: rows.length, created_by: callerId, idempotency_key: idemKey })
    .select('id')
    .single()
  if (impErr) {
    if (impErr.code === '23505') throw conflict('import_in_progress')
    ctx.log.error('import insert failed', { error: impErr.message })
    throw new HttpError(500, 'import_failed')
  }

  // Current state.
  const [profiles, invites, setting] = await Promise.all([
    fetchAll((a, b) => db.from('profiles').select('id,email,student_code,role').order('id').range(a, b)),
    fetchAll((a, b) => db.from('student_invites').select('id,email,first_name,last_name,phone,student_code,status').order('id').range(a, b)),
    db.from('app_settings').select('value').eq('key', 'signup_code').maybeSingle(),
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
    const { error } = await db.from('student_invites').upsert(part, { onConflict: 'email' })
    if (!error) continue
    // Race: a parallel import took one of the generated codes (unique index) —
    // retry row by row so only the colliding rows are skipped.
    for (const one of part) {
      const { error: e1 } = await db.from('student_invites').upsert(one, { onConflict: 'email' })
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
    const { error } = await db.from('profiles').update({ student_code: p.student_code }).eq('id', p.target_id)
    if (error) {
      p.reason = 'code_taken'
      p.student_code = profilesByEmail.get(p.email)?.student_code ?? null
    }
  }

  // Send.
  let mail = new Map<string, MailResult>()
  const mailConfigured = Boolean(ctx.env('RESEND_API_KEY') && ctx.env('MAIL_FROM'))
  const invitedEmails = plan.filter((p) => p.outcome === 'invite_new' || p.outcome === 'invite_update').map((p) => p.email)
  const idByEmail = new Map<string, string>()
  if (invitedEmails.length) {
    const saved = []
    for (const part of chunks(invitedEmails, 300)) {
      const { data, error } = await db.from('student_invites').select(INVITE_COLS).in('email', part)
      if (error) throw error
      saved.push(...(data ?? []))
    }
    for (const s of saved) idByEmail.set(s.email, s.id)
    if (body.send === true) mail = await sendInvites(ctx, db, saved)
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
    emails_failed: count((r) => r.mail === 'failed' || r.mail === 'queued'),
  }
  const { error: updErr } = await db
    .from('student_imports')
    .update({ ...summary, rows: resultRows, completed_at: new Date().toISOString() })
    .eq('id', imp.id)
  if (updErr) ctx.log.error('import summary update failed', { error: updErr.message })

  ctx.log.info('import done', { import_id: imp.id, ...summary })
  return ctx.json({ import_id: imp.id, summary, rows: resultRows, mail_configured: mailConfigured })
}

async function handleSend(ctx: Ctx, db: any, body: any) {
  const ids: string[] = Array.isArray(body.invite_ids) ? body.invite_ids.filter(isUuid) : []
  if (!ids.length) throw badRequest('invalid_input')
  if (ids.length > MAX_SEND_PER_CALL) throw badRequest('too_many', { max: MAX_SEND_PER_CALL })
  const rows: InviteRow[] = []
  for (const part of chunks([...new Set(ids)], 300)) {
    const { data, error } = await db.from('student_invites').select(INVITE_COLS).in('id', part)
    if (error) throw error
    rows.push(...(data ?? []))
  }
  const result = await sendInvites(ctx, db, rows)
  const tally: Record<string, number> = {}
  for (const v of result.values()) tally[v] = (tally[v] ?? 0) + 1
  ctx.log.info('send done', { tally })
  return ctx.json({ results: Object.fromEntries(result), tally, mail_configured: Boolean(ctx.env('RESEND_API_KEY') && ctx.env('MAIL_FROM')) })
}

/** Background job: re-send failed invites whose backoff has expired. */
async function handleRetry(ctx: Ctx, db: any) {
  const { data, error } = await db
    .from('student_invites')
    .select(INVITE_COLS)
    .eq('status', 'failed')
    .lte('next_attempt_at', new Date().toISOString())
    .lt('attempts', MAX_ATTEMPTS)
    .order('next_attempt_at')
    .limit(200)
  if (error) throw error
  const result = await sendInvites(ctx, db, data ?? [], { ignoreCooldown: true })
  const tally: Record<string, number> = {}
  for (const v of result.values()) tally[v] = (tally[v] ?? 0) + 1
  ctx.log.info('retry run', { due: data?.length ?? 0, tally })
  return ctx.json({ due: data?.length ?? 0, tally })
}

// ── entry ───────────────────────────────────────────────────────────────────

serve('admin-invite-students', { corsExtraHeaders: 'x-cron-secret' }, async (ctx) => {
  const body = await readJson(ctx.req, MAX_BODY_BYTES)
  const db = serviceClient()

  if (body.action === 'retry') {
    // Worker auth: the secret pg_cron sends is checked against the one the
    // database generated in Vault (verify_worker_secret). CRON_SECRET, if set
    // as a function secret, is accepted too.
    const given = ctx.req.headers.get('x-cron-secret') ?? ''
    const envSecret = ctx.env('CRON_SECRET')
    let ok = Boolean(envSecret) && timingSafeEqual(given, envSecret!)
    if (!ok && given) {
      const { data, error } = await db.rpc('verify_worker_secret', { p_secret: given })
      if (error) ctx.log.error('worker secret check failed', { error: error.message })
      ok = data === true
    }
    if (!ok) throw unauthorized('bad_cron_secret')
    return await handleRetry(ctx, db)
  }

  const { user } = await requireAdmin(ctx)
  if (body.action === 'import') {
    await enforceRateLimit(db, ctx.log, `invite-import:${user.id}`, 30, 3600)
    return await handleImport(ctx, db, user.id, body)
  }
  if (body.action === 'send') {
    await enforceRateLimit(db, ctx.log, `invite-send:${user.id}`, 120, 3600)
    return await handleSend(ctx, db, body)
  }
  throw badRequest('unknown_action')
})
