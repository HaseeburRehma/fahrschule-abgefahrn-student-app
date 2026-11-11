import { describe, expect, it } from 'vitest'

import { deliveryStatusFor, signSvix, verifySvix } from '../supabase/functions/_shared/webhook'

const secret = 'whsec_' + Buffer.from('a-test-signing-key-32-bytes-long!').toString('base64')
const body = JSON.stringify({ type: 'email.bounced', data: { email_id: 'abc' } })

describe('webhook signatures (Svix / Resend)', () => {
  it('accepts a correctly signed, fresh delivery', async () => {
    const sig = await signSvix(secret, 'msg_1', '1000', body)
    expect(await verifySvix(secret, { id: 'msg_1', timestamp: '1000', signature: sig }, body, 1010)).toEqual({ ok: true })
  })

  it('accepts when one of several signatures matches (secret rotation)', async () => {
    const sig = await signSvix(secret, 'msg_1', '1000', body)
    expect((await verifySvix(secret, { id: 'msg_1', timestamp: '1000', signature: `v1,AAAA ${sig}` }, body, 1000)).ok).toBe(true)
  })

  it('rejects tampered bodies, wrong ids and forged signatures', async () => {
    const sig = await signSvix(secret, 'msg_1', '1000', body)
    expect(await verifySvix(secret, { id: 'msg_1', timestamp: '1000', signature: sig }, body.replace('bounced', 'delivered'), 1000)).toEqual({ ok: false, reason: 'bad_signature' })
    expect(await verifySvix(secret, { id: 'msg_2', timestamp: '1000', signature: sig }, body, 1000)).toEqual({ ok: false, reason: 'bad_signature' })
    expect(await verifySvix(secret, { id: 'msg_1', timestamp: '1000', signature: 'v1,Zm9yZ2Vk' }, body, 1000)).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects replays outside the 5-minute window and missing headers', async () => {
    const sig = await signSvix(secret, 'msg_1', '1000', body)
    expect(await verifySvix(secret, { id: 'msg_1', timestamp: '1000', signature: sig }, body, 1000 + 301)).toEqual({ ok: false, reason: 'stale_timestamp' })
    expect(await verifySvix(secret, { id: null, timestamp: '1000', signature: sig }, body, 1000)).toEqual({ ok: false, reason: 'missing_headers' })
  })

  it('maps Resend event types', () => {
    expect(deliveryStatusFor('email.delivered')).toBe('delivered')
    expect(deliveryStatusFor('email.bounced')).toBe('bounced')
    expect(deliveryStatusFor('email.opened')).toBeNull()
  })
})
