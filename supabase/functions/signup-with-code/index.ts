// @ts-nocheck  — Deno edge function (Deno global + https: imports). Checked by
// the Deno runtime at deploy, not by the app's TypeScript.
// ============================================================================
// signup-with-code — public self sign-up for students (Figma "Registrieren").
//
// The app sends { first_name, last_name, email, password, school_code, locale }.
// The school code must match app_settings.signup_code (e.g. "ABG-2026"); only
// then a confirmed auth user + student profile is created. The app signs in
// with the password right after.
//
//   400 invalid_input | 403 invalid_code | 409 email_exists | 429 rate_limited
//
// Deploy:  supabase functions deploy signup-with-code --no-verify-jwt
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

// Best-effort per-instance throttle against code guessing.
const hits = new Map<string, number[]>()
function limited(ip: string) {
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000)
  arr.push(now)
  hits.set(ip, arr)
  return arr.length > 8
}

/** HaveIBeenPwned k-anonymity check (only a 5-char SHA-1 prefix leaves the server). Fails open. */
async function isPwned(password: string): Promise<boolean> {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password))
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true' },
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer))
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (limited(ip)) return json({ error: 'rate_limited' }, 429)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_input' }, 400)
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const first = String(body.first_name ?? '').trim().slice(0, 60)
  const last = String(body.last_name ?? '').trim().slice(0, 60)
  const locale = body.locale === 'en' ? 'en' : 'de'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !first) return json({ error: 'invalid_input' }, 400)
  // same policy as Auth (password_required_characters): ≥ 8, at least one letter and one digit
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return json({ error: 'weak_password' }, 400)
  }
  if (await isPwned(password)) return json({ error: 'pwned_password' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: setting } = await admin.from('app_settings').select('value').eq('key', 'signup_code').maybeSingle()
  const expected = norm(setting?.value)
  if (!expected || norm(body.school_code) !== expected) return json({ error: 'invalid_code' }, 403)

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'student', first_name: first, last_name: last },
  })
  if (createErr || !created?.user) {
    const msg = String(createErr?.message ?? '').toLowerCase()
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      return json({ error: 'email_exists' }, 409)
    }
    return json({ error: createErr?.message ?? 'create_failed' }, 400)
  }

  const { error: updErr } = await admin
    .from('profiles')
    .update({ email, first_name: first, last_name: last || null, role: 'student', locale })
    .eq('id', created.user.id)
  if (updErr) return json({ error: updErr.message }, 500)

  return json({ id: created.user.id })
})
