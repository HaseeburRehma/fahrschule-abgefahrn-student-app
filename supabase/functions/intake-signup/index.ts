// ============================================================================
// intake-signup — public endpoint the website's "Online Anmeldung" form POSTs
// to. Inserts a signup_intake row (status='pending') for an admin to review.
//
// Security: a shared secret. Set INTAKE_SECRET as a function secret and send it
// from the form as an `x-intake-secret` header (or `?secret=` query param).
//
// Accepts JSON or form-urlencoded bodies. Field names are matched loosely so it
// works with whatever the WordPress form plugin emits; the full body is always
// stored in `raw` for reference.
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

// First present, non-empty value among candidate keys (case-insensitive).
function pick(obj: Record<string, any>, keys: string[]): string | null {
  const lower: Record<string, any> = {}
  for (const k of Object.keys(obj)) lower[k.toLowerCase()] = obj[k]
  for (const k of keys) {
    const v = lower[k.toLowerCase()]
    if (v != null && String(v).trim() !== '') return String(v).trim()
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

  // Parse JSON or form-urlencoded.
  let raw: Record<string, any> = {}
  const ct = req.headers.get('content-type') ?? ''
  try {
    if (ct.includes('application/json')) {
      raw = await req.json()
    } else {
      const text = await req.text()
      raw = Object.fromEntries(new URLSearchParams(text))
    }
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const first_name = pick(raw, ['first_name', 'vorname', 'firstname', 'fname'])
  const last_name = pick(raw, ['last_name', 'nachname', 'lastname', 'lname', 'name'])
  const email = pick(raw, ['email', 'e-mail', 'e_mail', 'mail'])
  const phone = pick(raw, ['phone', 'nummer', 'telefon', 'tel', 'mobile', 'handy'])
  const service_label = pick(raw, [
    'service',
    'service_label',
    'paket',
    'package',
    'kurs',
    'angebot',
    'leistung',
  ])
  const payment = pick(raw, ['payment', 'zahlung', 'zahlungsart', 'bezahlung'])

  if (!email && !first_name && !last_name) {
    return json({ error: 'empty_submission' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await supabase
    .from('signup_intake')
    .insert({
      first_name,
      last_name,
      email,
      phone,
      service_label,
      payment,
      raw,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return json({ error: error.message }, 500)
  return json({ ok: true, id: data.id })
})
