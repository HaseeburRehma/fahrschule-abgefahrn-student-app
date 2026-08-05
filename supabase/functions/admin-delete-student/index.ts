// @ts-nocheck  — Deno edge function (Deno global + https: imports). Checked by
// the Deno runtime at deploy, not by the app's TypeScript.
// ============================================================================
// admin-delete-student — permanently deletes a student.
//
// Only an authenticated ADMIN may call it. Deletes the auth user via the
// service role; the FK cascades remove the profile, package links, class
// enrolments, and notifications automatically.
//
// Called from the app via supabase.functions.invoke('admin-delete-student').
// Deploy:  supabase functions deploy admin-delete-student
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'missing_authorization' }, 401)

  // Verify the caller is a signed-in admin.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userRes } = await caller.auth.getUser()
  if (!userRes?.user) return json({ error: 'unauthenticated' }, 401)
  const { data: isAdmin, error: adminErr } = await caller.rpc('is_admin')
  if (adminErr) return json({ error: adminErr.message }, 500)
  if (!isAdmin) return json({ error: 'forbidden' }, 403)

  let body: { id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  const id = (body.id ?? '').trim()
  if (!id) return json({ error: 'missing_id' }, 400)

  // Don't allow deleting an admin (safety) or yourself.
  if (id === userRes.user.id) return json({ error: 'cannot_delete_self' }, 400)

  const admin = createClient(url, serviceKey)
  const { data: target } = await admin
    .from('profiles')
    .select('role')
    .eq('id', id)
    .maybeSingle()
  if (target?.role === 'admin') return json({ error: 'cannot_delete_admin' }, 400)

  const { error: delErr } = await admin.auth.admin.deleteUser(id)
  if (delErr) return json({ error: delErr.message }, 500)

  return json({ ok: true, id })
})
