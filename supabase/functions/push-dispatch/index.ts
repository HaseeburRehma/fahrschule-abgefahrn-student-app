// @ts-nocheck  — Deno edge function (Deno global + https: imports). Checked by
// the Deno runtime at deploy, not by the app's TypeScript.
// ============================================================================
// push-dispatch — sends an Expo push when a notification row is inserted.
//
// Wired as a Supabase **Database Webhook** on INSERT of public.notifications
// (Dashboard → Database → Webhooks). The webhook POSTs the new row here; we
// look up the recipient's Expo push token and forward to Expo's push service.
//
// Env (auto-provided by Supabase): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Required: WEBHOOK_SECRET — the caller must send a matching `x-webhook-secret`
//           header (the DB trigger reads it from Vault 'push_webhook_secret').
//
// Deploy:  supabase functions deploy push-dispatch --no-verify-jwt
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface NotificationRecord {
  id: string
  user_id: string
  title: string
  body: string | null
  type: string | null
  data: Record<string, unknown> | null
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: NotificationRecord | null
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

Deno.serve(async (req) => {
  // Shared-secret gate — REQUIRED (fail closed). The DB trigger
  // dispatch_push_on_notification sends it from Supabase Vault ('push_webhook_secret').
  const requiredSecret = Deno.env.get('WEBHOOK_SECRET')
  if (!requiredSecret || req.headers.get('x-webhook-secret') !== requiredSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  if (payload.type !== 'INSERT' || !payload.record?.id) {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Never trust the payload: load the real notification row and only push
  // fresh ones (prevents replaying old notifications or forged content).
  const { data: record } = await supabase
    .from('notifications')
    .select('id, user_id, title, body, type, data, created_at')
    .eq('id', payload.record.id)
    .maybeSingle()
  if (!record || Date.now() - new Date(record.created_at).getTime() > 15 * 60_000) {
    return new Response(JSON.stringify({ skipped: true, reason: 'not_found_or_stale' }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', record.user_id)
    .maybeSingle()

  if (error || !profile?.push_token) {
    // No device token → the recipient still gets the in-app realtime feed.
    return new Response(JSON.stringify({ delivered: false, reason: 'no_token' }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  const message = {
    to: profile.push_token,
    sound: 'default',
    title: record.title,
    body: record.body ?? '',
    data: { id: record.id, type: record.type ?? 'general', ...(record.data ?? {}) },
    channelId: 'default',
    priority: 'high',
  }

  const expoRes = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'accept-encoding': 'gzip, deflate',
    },
    body: JSON.stringify(message),
  })

  const expoJson = await expoRes.json().catch(() => null)

  return new Response(
    JSON.stringify({ delivered: expoRes.ok, expo: expoJson }),
    {
      status: expoRes.ok ? 200 : 502,
      headers: { 'content-type': 'application/json' },
    },
  )
})
