// @ts-nocheck  — Deno edge function (Deno global + https: imports). Checked by
// the Deno runtime at deploy, not by the app's TypeScript.
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
// Security: a shared secret. Set INTAKE_SECRET as a function secret and send it
// from the form as `?secret=` (or `x-intake-secret` header).
// Accepts JSON or form-urlencoded. The full body is always stored in `raw`.
//
// Deploy:  supabase functions deploy intake-signup --no-verify-jwt
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-intake-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const secret = Deno.env.get('INTAKE_SECRET')
  if (secret) {
    const url = new URL(req.url)
    const got =
      req.headers.get('x-intake-secret') ?? url.searchParams.get('secret')
    if (got !== secret) return json({ error: 'unauthorized' }, 401)
  }

  let raw: Record<string, any> = {}
  const ct = req.headers.get('content-type') ?? ''
  try {
    if (ct.includes('application/json')) raw = await req.json()
    else raw = Object.fromEntries(new URLSearchParams(await req.text()))
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const first_name = pick(raw, ['first_name', 'first-name', 'vorname', 'firstname', 'fname', 'first'])
  const last_name = pick(raw, ['last_name', 'last-name', 'nachname', 'lastname', 'lname', 'last', 'name'])
  const email = pick(raw, ['email', 'e-mail', 'e_mail', 'mail'])
  const phone = pick(raw, ['phone', 'nummer', 'telefon', 'tel', 'mobile', 'handy'])
  const service_label = pick(raw, ['service', 'service_label', 'paket', 'package', 'kurs', 'angebot', 'leistung'])
  const payment = pick(raw, ['payment', 'zahlung', 'zahlungsart', 'bezahlung'])
  const form_title = pick(raw, ['form_title', 'form_name'])

  // Real sign-up must carry a real email. Forminator "Send test" sends field
  // labels ("E-Mail") — skip those (200 so the webhook doesn't retry).
  const cleanEmail =
    email && email.includes('@') ? email.trim().toLowerCase() : null
  if (!cleanEmail) return json({ ok: true, skipped: 'no_valid_email' }, 200)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Match the chosen package from the whole submission.
  const { data: packages } = await supabase
    .from('packages')
    .select('id, key, name_de')
    .order('sort', { ascending: true })
  const haystack = [service_label, form_title, ...Object.values(raw)]
    .filter((v) => typeof v === 'string')
    .join(' ')
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
    // Create a proper, OTP-ready student account (no password, email confirmed).
    const { data: made, error: cErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      email_confirm: true,
      user_metadata: { role: 'student', first_name, last_name },
    })
    if (cErr || !made?.user) {
      accountError = cErr?.message ?? 'create_failed'
    } else {
      studentId = made.user.id
      created = true
      // Fill the profile the trigger just created.
      await supabase
        .from('profiles')
        .update({
          first_name: first_name ?? null,
          last_name: last_name ?? null,
          phone: phone ?? null,
        })
        .eq('id', studentId)
      // Welcome notification (shows in their feed on first login).
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
    if (Object.keys(patch).length) {
      await supabase.from('profiles').update(patch).eq('id', existing.id)
    }
  }
  // (If the email belongs to an admin, we leave the account untouched.)

  // Assign the matched package to the student (idempotent).
  if (studentId && packageId && existing?.role !== 'admin') {
    await supabase
      .from('student_packages')
      .upsert(
        { student_id: studentId, package_id: packageId },
        { onConflict: 'student_id,package_id', ignoreDuplicates: true },
      )
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

  if (!studentId) return json({ ok: false, error: accountError }, 500)
  return json({ ok: true, student_id: studentId, created, package_id: packageId })
})
