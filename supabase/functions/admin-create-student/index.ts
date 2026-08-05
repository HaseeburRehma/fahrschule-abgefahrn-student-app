// @ts-nocheck  — Deno edge function (Deno global + https: imports). Checked by
// the Deno runtime at deploy, not by the app's TypeScript.
// ============================================================================
// admin-create-student — provisions a passwordless student account.
//
// Only an authenticated ADMIN may call it. It creates the auth user (no
// password; email pre-confirmed so OTP login works immediately), lets the
// on_auth_user_created trigger insert the profile, then fills in name/phone,
// the current theory topic, and any package assignments.
//
// Called from the app via supabase.functions.invoke('admin-create-student').
// Deploy:  supabase functions deploy admin-create-student
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

interface Body {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  current_theory_topic_id?: string | null
  package_ids?: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'missing_authorization' }, 401)

  // 1) Verify the caller is a signed-in admin (RLS/JWT bound).
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userRes } = await caller.auth.getUser()
  if (!userRes?.user) return json({ error: 'unauthenticated' }, 401)
  const { data: isAdmin, error: adminErr } = await caller.rpc('is_admin')
  if (adminErr) return json({ error: adminErr.message }, 500)
  if (!isAdmin) return json({ error: 'forbidden' }, 403)

  // 2) Parse input.
  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  const email = (body.email ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) return json({ error: 'invalid_email' }, 400)

  // 3) Create the auth user with the service role.
  const admin = createClient(url, serviceKey)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { role: 'student' },
  })
  if (createErr || !created?.user) {
    return json({ error: createErr?.message ?? 'create_failed' }, 400)
  }
  const uid = created.user.id

  // 4) Fill in the profile (the trigger already created the base row).
  const { error: updErr } = await admin
    .from('profiles')
    .update({
      email,
      first_name: body.first_name ?? null,
      last_name: body.last_name ?? null,
      phone: body.phone ?? null,
      role: 'student',
      current_theory_topic_id: body.current_theory_topic_id ?? null,
    })
    .eq('id', uid)
  if (updErr) return json({ error: updErr.message }, 500)

  // 5) Assign packages.
  if (body.package_ids?.length) {
    const rows = body.package_ids.map((pid) => ({
      student_id: uid,
      package_id: pid,
    }))
    const { error: pkgErr } = await admin.from('student_packages').insert(rows)
    if (pkgErr) return json({ error: pkgErr.message }, 500)
  }

  return json({ id: uid })
})
