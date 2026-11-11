// @ts-nocheck  — Deno edge function. Checked by `deno check` in CI.
// ============================================================================
// push-dispatch — sends an Expo push when a notification row is inserted.
//
// Called by the database (trigger dispatch_push_on_notification → pg_net) —
// an internal webhook. Security & reliability:
//   * shared secret WEBHOOK_SECRET in `x-webhook-secret`, compared in constant
//     time, fail closed when unset
//   * the payload is never trusted: the real row is re-read, stale rows skipped
//   * idempotent: each notification id is pushed at most once (webhook_events),
//     so a retried webhook can't double-notify a student
//   * Expo call with timeout; retried only on 429/503 (nothing was delivered)
//
// Deploy:  supabase functions deploy push-dispatch --no-verify-jwt
// ============================================================================

import { HttpError, fetchWithRetry, isUuid, readJson, timingSafeEqual, unauthorized } from '../_shared/http.ts'
import { serve, serviceClient } from '../_shared/serve.ts'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

serve('push-dispatch', {}, async (ctx) => {
  const secret = ctx.env('WEBHOOK_SECRET')
  if (!secret) throw new HttpError(503, 'not_configured')
  if (!timingSafeEqual(ctx.req.headers.get('x-webhook-secret') ?? '', secret)) throw unauthorized('bad_secret')

  const payload = await readJson(ctx.req, 50_000)
  const id = payload?.record?.id
  if (payload.type !== 'INSERT' || !isUuid(id)) return ctx.json({ skipped: true })

  const db = serviceClient()
  const { data: record } = await db
    .from('notifications')
    .select('id, user_id, title, body, type, data, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!record || Date.now() - new Date(record.created_at).getTime() > 15 * 60_000) {
    return ctx.json({ skipped: true, reason: 'not_found_or_stale' })
  }

  // Idempotency: claim this notification once.
  const { error: dupErr } = await db.from('webhook_events').insert({ id: `push:${record.id}`, source: 'db', type: 'notification.insert' })
  if (dupErr) {
    if (dupErr.code === '23505') return ctx.json({ skipped: true, reason: 'duplicate' })
    ctx.log.warn('dedupe insert failed (continuing)', { error: dupErr.message })
  }

  const { data: profile } = await db.from('profiles').select('push_token').eq('id', record.user_id).maybeSingle()
  if (!profile?.push_token) return ctx.json({ delivered: false, reason: 'no_token' })

  const message = {
    to: profile.push_token,
    sound: 'default',
    title: String(record.title).slice(0, 178),
    body: String(record.body ?? '').slice(0, 1000),
    data: { id: record.id, type: record.type ?? 'general', ...(record.data ?? {}) },
    channelId: 'default',
    priority: 'high',
  }

  let expoRes: Response
  try {
    expoRes = await fetchWithRetry(
      EXPO_PUSH_URL,
      { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(message) },
      { retries: 2, timeoutMs: 8000, retryOn: (s) => s === 429 || s === 503, onRetry: (i) => ctx.log.warn('expo retry', i) },
    )
  } catch (e) {
    ctx.log.error('expo unreachable', { error: e })
    throw new HttpError(502, 'push_provider_unreachable')
  }
  const expoJson = await expoRes.json().catch(() => null)
  const ticket = Array.isArray(expoJson?.data) ? expoJson.data[0] : expoJson?.data

  // Dead token (app uninstalled / rotated) → forget it.
  if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
    await db.from('profiles').update({ push_token: null }).eq('id', record.user_id).eq('push_token', profile.push_token)
  }
  const delivered = expoRes.ok && ticket?.status === 'ok'
  if (!delivered) ctx.log.warn('push not delivered', { status: expoRes.status, expo_error: ticket?.details?.error ?? ticket?.message })
  if (!expoRes.ok) throw new HttpError(502, 'push_provider_error')
  return ctx.json({ delivered })
})
