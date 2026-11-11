// @ts-nocheck  — Deno edge function. Checked by `deno check` in CI.
// ============================================================================
// intake-signup — the website "Online Anmeldung" (registration + package
// purchase) POSTs here. It AUTO-CREATES the student's account so they can log
// in immediately with the email they submitted, assigns the package they
// picked, drops a welcome notification, and records an audit row.
//
// Trigger today = the WordPress form submission (which is the purchase step).
// When a real payment gateway is connected later, point its webhook at this
// same function (send the same fields) — the logic is unchanged.
//
// Security: shared secret INTAKE_SECRET, preferably in the `x-intake-secret`
// header (constant-time compare, fail closed). `?secret=` still works for the
// existing WordPress form but is logged as deprecated — query strings end up
// in access logs, so move the form to the header and rotate the secret.
// Body ≤ 64 KB, 30 submissions / hour per IP, e-mail validated server-side.
//
// Deploy:  supabase functions deploy intake-signup --no-verify-jwt
// ============================================================================

import { HttpError, badRequest, timingSafeEqual, tooLarge, unauthorized } from '../_shared/http.ts'
import { isValidEmail, normalizeEmail } from '../_shared/invites.ts'
import { enforceRateLimit, serve, serviceClient } from '../_shared/serve.ts'

const MAX_BODY = 64_000
const clip = (v: string | null, n: number) => (v == null ? null : v.slice(0, n))

// First non-empty value whose key matches a candidate (exact, then substring).
function pick(obj: Record<string, any>, keys: string[]): string | null {
  const entries = Object.entries(obj).map(
    ([k, v]) => [k.toLowerCase(), v] as [string, any],
  )
  const val = (v: any) =>
    v != null && String(v).trim() !== '' ? String(v).trim() : null
  for (const k of keys) {
    const hit = entries.find(([kk]) => kk === k.toLowerCase())
    if (hit && val(hit[1])) return val(hit[1])
  }
  for (const k of keys) {
    const hit = entries.find(([kk]) => kk.includes(k.toLowerCase()))
    if (hit && val(hit[1])) return val(hit[1])
  }
  return null
}

const norm = (s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/gi, '')

// Match the selected service text to one of our packages. Packages are passed
// sorted by `sort`, so the "Grundbetrag" combo (whose label also mentions
// Intensivkurs) matches Grundbetrag first — the correct package.
function matchPackageId(
  packages: { id: string; key: string; name_de: string }[],
  haystack: string,
): string | null {
  const h = norm(haystack)
  for (const p of packages) {
    for (const c of [p.key, p.name_de].filter(Boolean).map(norm)) {
      if (c.length >= 4 && h.includes(c)) return p.id
    }
  }
  return null
}

serve('intake-signup', { corsExtraHeaders: 'x-intake-secret' }, async (ctx) => {
  const { req, log } = ctx
  const secret = ctx.env('INTAKE_SECRET')
  if (!secret) throw new HttpError(503, 'not_configured') // fail closed
  const fromHeader = req.headers.get('x-intake-secret')
  const fromQuery = new URL(req.url).searchParams.get('secret')
  if (!fromHeader && fromQuery) log.warn('intake secret sent in query string (deprecated)')
  if (!timingSafeEqual(fromHeader ?? fromQuery ?? '', secret)) throw unauthorized()

  const supabase = serviceClient()
  await enforceRateLimit(supabase, log, `intake:ip:${ctx.ip}`, 30, 3600)

  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) throw tooLarge()
  const text = await req.text()
  if (text.length > MAX_BODY) throw tooLarge()
  let raw: Record<string, any> = {}
  try {
    const ct = req.headers.get('content-type') ?? ''
    raw = ct.includes('application/json') ? JSON.parse(text) : Object.fromEntries(new URLSearchParams(text))
  } catch {
    throw badRequest('invalid_body')
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw badRequest('invalid_body')

  const first_name = clip(pick(raw, ['first_name', 'first-name', 'vorname', 'firstname', 'fname', 'first']), 100)
  const last_name = clip(pick(raw, ['last_name', 'last-name', 'nachname', 'lastname', 'lname', 'last', 'name']), 100)
  const email = pick(raw, ['email', 'e-mail', 'e_mail', 'mail'])
  const phone = clip(pick(raw, ['phone', 'nummer', 'telefon', 'tel', 'mobile', 'handy']), 40)
  const service_label = clip(pick(raw, ['service', 'service_label', 'paket', 'package', 'kurs', 'angebot', 'leistung']), 300)
  const payment = clip(pick(raw, ['payment', 'zahlung', 'zahlungsart', 'bezahlung']), 100)
  const form_title = clip(pick(raw, ['form_title', 'form_name']), 200)

  // Real sign-up must carry a real email. Forminator "Send test" sends field
  // labels ("E-Mail") — skip those (200 so the webhook doesn't retry).
  const cleanEmail = normalizeEmail(email)
  if (!isValidEmail(cleanEmail)) return ctx.json({ ok: true, skipped: 'no_valid_email' })

  // Match the chosen package from the whole submission.
  const { data: packages } = await supabase.from('packages').select('id, key, name_de').order('sort', { ascending: true })
  const haystack = [service_label, form_title, ...Object.values(raw)].filter((v) => typeof v === 'string').join(' ')
  const packageId = matchPackageId((packages ?? []) as any, haystack)

  // Is there already an account for this email?
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, role, first_name, last_name, phone')
    .eq('email', cleanEmail)
    .maybeSingle()

  let studentId: string | null = existing?.id ?? null
  let created = false
  let accountError: string | null = null

  if (!existing) {
    const { data: made, error: cErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      email_confirm: true,
      user_metadata: { role: 'student', first_name, last_name },
    })
    if (cErr || !made?.user) {
      accountError = 'create_failed'
      log.error('create user failed', { error: cErr?.message })
    } else {
      studentId = made.user.id
      created = true
      await supabase.from('profiles').update({ first_name, last_name, phone }).eq('id', studentId)
      await supabase.from('notifications').insert({
        user_id: studentId,
        title: 'Willkommen bei Fahrschule Abgefahrn! 🎉',
        body: 'Dein Konto wurde erstellt. Melde dich mit dieser E-Mail an, um Termine und Mitteilungen zu erhalten.',
        type: 'general',
      })
    }
  } else if (existing.role === 'student') {
    // Existing student re-registering: fill any blanks, don't overwrite.
    const patch: Record<string, any> = {}
    if (first_name && !existing.first_name) patch.first_name = first_name
    if (last_name && !existing.last_name) patch.last_name = last_name
    if (phone && !existing.phone) patch.phone = phone
    if (Object.keys(patch).length) await supabase.from('profiles').update(patch).eq('id', existing.id)
  }
  // (If the email belongs to an admin, we leave the account untouched.)

  // Assign the matched package (idempotent upsert).
  if (studentId && packageId && existing?.role !== 'admin') {
    await supabase
      .from('student_packages')
      .upsert({ student_id: studentId, package_id: packageId }, { onConflict: 'student_id,package_id', ignoreDuplicates: true })
  }

  // Audit row: 'converted' when an account exists/was made, else 'pending'
  // (so an admin can retry from the Anmeldungen screen).
  await supabase.from('signup_intake').insert({
    first_name,
    last_name,
    email: cleanEmail,
    phone,
    service_label: service_label ?? form_title,
    payment,
    raw,
    status: studentId ? 'converted' : 'pending',
  })

  if (!studentId) throw new HttpError(500, accountError ?? 'create_failed')
  log.info('intake processed', { created, student_id: studentId, package_id: packageId })
  return ctx.json({ ok: true, student_id: studentId, created, package_id: packageId })
})
