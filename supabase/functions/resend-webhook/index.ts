// @ts-nocheck  — Deno edge function. Checked by `deno check` in CI.
// ============================================================================
// resend-webhook — delivery events from Resend (delivered / bounced /
// complained / delayed) → student_invites.delivery_status, so the invites
// screen shows which addresses bounced. Bounced/complained addresses are never
// retried automatically.
//
// Security: Svix signature (RESEND_WEBHOOK_SECRET, "whsec_…") over the raw
// body, 5-minute timestamp window (replay protection), and every svix-id is
// processed only once (webhook_events) → idempotent even when Resend retries.
// Unknown event types are acknowledged with 200 so Resend doesn't retry them.
//
// Setup: Resend → Webhooks → endpoint
//   https://<project>.supabase.co/functions/v1/resend-webhook
//   events: email.delivered, email.bounced, email.complained, email.delivery_delayed
// Deploy:  supabase functions deploy resend-webhook --no-verify-jwt
// ============================================================================

import { HttpError, badRequest, tooLarge, unauthorized } from '../_shared/http.ts'
import { deliveryStatusFor, verifySvix } from '../_shared/webhook.ts'
import { serve, serviceClient } from '../_shared/serve.ts'

serve('resend-webhook', {}, async (ctx) => {
  const secret = ctx.env('RESEND_WEBHOOK_SECRET')
  if (!secret) throw new HttpError(503, 'not_configured')

  const raw = await ctx.req.text()
  if (raw.length > 256_000) throw tooLarge()
  const h = ctx.req.headers
  const id = h.get('svix-id')
  const check = await verifySvix(secret, { id, timestamp: h.get('svix-timestamp'), signature: h.get('svix-signature') }, raw)
  if (!check.ok) {
    ctx.log.warn('webhook rejected', { reason: check.reason })
    throw unauthorized('invalid_signature')
  }

  let event: any
  try {
    event = JSON.parse(raw)
  } catch {
    throw badRequest('invalid_json')
  }
  const type = String(event?.type ?? '')
  const messageId = typeof event?.data?.email_id === 'string' ? event.data.email_id : null

  const db = serviceClient()
  const { error: dupErr } = await db.from('webhook_events').insert({ id: `resend:${id}`, source: 'resend', type: type.slice(0, 60) })
  if (dupErr?.code === '23505') return ctx.json({ ok: true, duplicate: true })
  if (dupErr) ctx.log.warn('dedupe insert failed (continuing)', { error: dupErr.message })

  const status = deliveryStatusFor(type)
  if (!status || !messageId) return ctx.json({ ok: true, ignored: type })

  const patch: Record<string, unknown> = { delivery_status: status, delivery_updated_at: new Date().toISOString() }
  if (status === 'bounced' || status === 'complained') {
    patch.status = 'failed'
    patch.last_error = status
    patch.next_attempt_at = null
  }
  const { data, error } = await db.from('student_invites').update(patch).eq('provider_message_id', messageId).select('id')
  if (error) {
    ctx.log.error('invite update failed', { error: error.message })
    throw new HttpError(500, 'update_failed') // Resend retries later
  }
  ctx.log.info('delivery event', { type, matched: data?.length ?? 0 })
  return ctx.json({ ok: true, matched: data?.length ?? 0 })
})
