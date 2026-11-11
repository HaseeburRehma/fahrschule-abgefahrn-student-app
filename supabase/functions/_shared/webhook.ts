/**
 * Webhook signature verification (Svix scheme — used by Resend).
 *
 *   signed content = `${svix-id}.${svix-timestamp}.${raw body}`
 *   signature      = base64(HMAC-SHA256(secret, signed content))
 *   header         = "v1,<sig> v1,<sig2>"  (several during secret rotation)
 *   secret         = "whsec_" + base64(key)
 *
 * Replay protection: the timestamp must be within `toleranceSec` of now, and
 * the caller stores svix-id so the same delivery is processed only once.
 * Pure WebCrypto — runs in Deno and Node.
 */

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

async function hmac(keyBytes: Uint8Array, content: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(content))
  return bytesToB64(new Uint8Array(sig))
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export type WebhookCheck = { ok: true } | { ok: false; reason: 'missing_headers' | 'bad_secret' | 'stale_timestamp' | 'bad_signature' }

export async function verifySvix(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  rawBody: string,
  nowSec = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): Promise<WebhookCheck> {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature) return { ok: false, reason: 'missing_headers' }
  let key: Uint8Array
  try {
    key = b64ToBytes(secret.startsWith('whsec_') ? secret.slice(6) : secret)
  } catch {
    return { ok: false, reason: 'bad_secret' }
  }
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > toleranceSec) return { ok: false, reason: 'stale_timestamp' }
  const expected = await hmac(key, `${id}.${timestamp}.${rawBody}`)
  const given = signature.split(' ').map((p) => p.split(',')).filter(([v]) => v === 'v1').map(([, s]) => s ?? '')
  return given.some((s) => safeEqual(s, expected)) ? { ok: true } : { ok: false, reason: 'bad_signature' }
}

/** Test/helper: produce a valid header value for a payload. */
export async function signSvix(secret: string, id: string, timestamp: string, rawBody: string): Promise<string> {
  const key = b64ToBytes(secret.startsWith('whsec_') ? secret.slice(6) : secret)
  return `v1,${await hmac(key, `${id}.${timestamp}.${rawBody}`)}`
}

/** Resend event type → our invite delivery status. Unknown types are ignored. */
export function deliveryStatusFor(type: string): 'delivered' | 'bounced' | 'complained' | 'delayed' | null {
  switch (type) {
    case 'email.delivered':
      return 'delivered'
    case 'email.bounced':
      return 'bounced'
    case 'email.complained':
      return 'complained'
    case 'email.delivery_delayed':
      return 'delayed'
    default:
      return null
  }
}
