// @ts-nocheck  — Deno edge function (Deno global + https: imports). Checked by
// the Deno runtime at deploy, not by the app's TypeScript.
// ============================================================================
// delete-account — lets a signed-in user delete THEIR OWN account (required by
// the App Store / Play Store). Verifies the caller from their JWT, then deletes
// that auth user via the service role; FK cascades remove profile, packages,
// enrolments and notifications. Admins can't self-delete here (avoids locking
// the school out); an admin removes another admin from the dashboard.
//
// Deploy:  supabase functions deploy delete-account
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

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userRes } = await caller.auth.getUser()
  if (!userRes?.user) return json({ error: 'unauthenticated' }, 401)
  const uid = userRes.user.id

  const admin = createClient(url, serviceKey)
  const { data: prof } = await admin
    .from('profiles')
    .select('role')
    .eq('id', uid)
    .maybeSingle()
  if (prof?.role === 'admin') return json({ error: 'admin_cannot_self_delete' }, 400)

  const { error } = await admin.auth.admin.deleteUser(uid)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
})
