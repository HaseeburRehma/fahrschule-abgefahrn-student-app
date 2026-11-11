// @ts-nocheck  — Deno edge function. Checked by `deno check` in CI.
// ============================================================================
// signup-with-code — public self sign-up for students (Figma "Registrieren").
//
// The app sends { first_name, last_name, email, password, school_code, locale }.
// `school_code` is either
//   * the shared school code (app_settings.signup_code), or
//   * a personal student code from an invite (student_invites) — accepted only
//     together with the e-mail address it was sent to.
// Then a confirmed auth user + student profile is created; the profile keeps
// the personal code (or gets one generated) and a matching invite is marked
// accepted. The app signs in with the password right after.
//
// Brute-force protection: 10 attempts / 10 min per IP and 5 / hour per e-mail
// (shared across instances via public.check_rate_limit), plus a per-instance
// fallback. Wrong codes all get the same 403 so codes can't be enumerated.
// Passwords: ≥ 8 chars with letter + digit, checked against HaveIBeenPwned
// (k-anonymity, only a 5-char hash prefix leaves the server); Supabase Auth
// stores them as salted bcrypt hashes.
//
//   201 { id } | 400 invalid_input / weak_password / pwned_password
//   403 invalid_code | 409 email_exists | 429 rate_limited | 500
//
// Deploy:  supabase functions deploy signup-with-code --no-verify-jwt
// ============================================================================

import { HttpError, conflict, fetchWithTimeout, forbidden, readJson, tooMany, badRequest } from '../_shared/http.ts'
import { cleanPhone, isValidEmail, normalizeEmail } from '../_shared/invites.ts'
import { enforceRateLimit, serve, serviceClient } from '../_shared/serve.ts'

// Per-instance fallback throttle (used when the shared limiter is unreachable).
const hits = new Map<string, number[]>()
function limitedLocally(ip: string) {
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000)
  arr.push(now)
  hits.set(ip, arr)
  if (hits.size > 5000) hits.clear() // bound memory
  return arr.length > 12
}

/** HaveIBeenPwned k-anonymity check (only a 5-char SHA-1 prefix leaves the server). Fails open. */
async function isPwned(password: string): Promise<boolean> {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password))
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    const res = await fetchWithTimeout(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { 'Add-Padding': 'true' } }, 4000)
    if (!res.ok) return false
    const suffix = hex.slice(5)
    return (await res.text()).split('\n').some((l) => {
      const [s, c] = l.trim().split(':')
      return s === suffix && Number(c) > 0
    })
  } catch {
    return false
  }
}

const norm = (s: unknown) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, '')

serve('signup-with-code', {}, async (ctx) => {
  const { log } = ctx
  if (limitedLocally(ctx.ip)) throw tooMany(600)
  const admin = serviceClient()
  await enforceRateLimit(admin, log, `signup:ip:${ctx.ip}`, 10, 600)

  const body = await readJson(ctx.req, 10_000)
  const email = normalizeEmail(body.email)
  const password = String(body.password ?? '')
  const first = String(body.first_name ?? '').trim().slice(0, 60)
  const last = String(body.last_name ?? '').trim().slice(0, 60)
  const locale = body.locale === 'en' ? 'en' : 'de'
  if (!isValidEmail(email) || !first) throw badRequest('invalid_input')
  await enforceRateLimit(admin, log, `signup:email:${email}`, 5, 3600)
  // same policy as Auth (password_required_characters): ≥ 8, at least one letter and one digit
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw badRequest('weak_password')
  }
  if (await isPwned(password)) throw badRequest('pwned_password')

  const { data: setting } = await admin.from('app_settings').select('value').eq('key', 'signup_code').maybeSingle()
  const expected = norm(setting?.value)
  const given = norm(body.school_code)
  if (!given || given.length > 40) throw forbidden('invalid_code')

  // Personal code → must belong to an open invite for exactly this address.
  // Shared school code → link an open invite for the address if there is one.
  let invite: any = null
  if (expected && given === expected) {
    const { data } = await admin
      .from('student_invites')
      .select('id,student_code,status,first_name,last_name,phone')
      .eq('email', email)
      .maybeSingle()
    if (data && data.status !== 'revoked' && data.status !== 'accepted') invite = data
  } else {
    const { data } = await admin
      .from('student_invites')
      .select('id,email,student_code,status,first_name,last_name,phone')
      .eq('student_code', given)
      .maybeSingle()
    if (!data || data.email !== email || data.status === 'revoked' || data.status === 'accepted') {
      log.info('invalid sign-up code')
      throw forbidden('invalid_code')
    }
    invite = data
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'student', first_name: first, last_name: last },
  })
  if (createErr || !created?.user) {
    const msg = String(createErr?.message ?? '').toLowerCase()
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) throw conflict('email_exists')
    log.error('create user failed', { error: createErr?.message })
    throw new HttpError(500, 'create_failed')
  }

  const uid = created.user.id
  const { error: updErr } = await admin
    .from('profiles')
    .update({
      email,
      first_name: first,
      last_name: last || invite?.last_name || null,
      role: 'student',
      locale,
      ...(invite?.phone ? { phone: cleanPhone(invite.phone) } : {}),
    })
    .eq('id', uid)
  if (updErr) {
    // Compensate: remove the half-created user so the student can simply retry.
    log.error('profile update failed — rolling back user', { error: updErr.message })
    await admin.auth.admin.deleteUser(uid).catch((e) => log.error('rollback failed', { error: e }))
    throw new HttpError(500, 'create_failed')
  }

  if (invite) {
    // Keep the invited code on the profile (a code generated on insert is replaced).
    const { error: codeErr } = await admin.from('profiles').update({ student_code: invite.student_code }).eq('id', uid)
    if (codeErr) log.error('could not set invited student code', { error: codeErr.message })
    const { error: invErr } = await admin
      .from('student_invites')
      .update({ status: 'accepted', accepted_at: new Date().toISOString(), profile_id: uid })
      .eq('id', invite.id)
    if (invErr) log.error('could not mark invite accepted', { error: invErr.message })
  }

  log.info('student signed up', { user_id: uid, via_invite: Boolean(invite) })
  return ctx.json({ id: uid }, 201)
})
