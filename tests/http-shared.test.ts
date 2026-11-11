import { describe, expect, it, vi } from 'vitest'

import {
  CircuitBreaker,
  HttpError,
  backoffDelay,
  checkApiVersion,
  clientIp,
  corsHeaders,
  createLogger,
  errorResponse,
  fetchWithRetry,
  fetchWithTimeout,
  maskEmail,
  readJson,
  redact,
  requestIdFrom,
  retryAfterMs,
  timingSafeEqual,
  TimeoutError,
} from '../supabase/functions/_shared/http'

const res = (status: number, headers: Record<string, string> = {}) => new Response('{}', { status, headers })

describe('structured logging', () => {
  it('writes one JSON line with request id and redacts secrets and e-mails', () => {
    const lines: string[] = []
    const log = createLogger('fn', 'req-12345678', (l) => lines.push(l), () => 0)
    log.info('hello', { password: 'hunter2', Authorization: 'Bearer x', email: 'max@example.de', nested: { api_key: 'k' } })
    const entry = JSON.parse(lines[0])
    expect(entry).toMatchObject({ level: 'info', fn: 'fn', request_id: 'req-12345678', msg: 'hello', password: '[redacted]', Authorization: '[redacted]', email: 'm***@example.de' })
    expect(entry.nested.api_key).toBe('[redacted]')
    expect(lines[0]).not.toContain('hunter2')
  })

  it('masks e-mails and trims huge values', () => {
    expect(maskEmail('anna@x.de')).toBe('a***@x.de')
    expect((redact('x'.repeat(1000)) as string).length).toBeLessThan(310)
    expect((redact(Array.from({ length: 50 }, (_, i) => i)) as unknown[]).length).toBe(21)
  })

  it('reuses a valid incoming request id and rejects junk', () => {
    expect(requestIdFrom(new Headers({ 'x-request-id': 'abc-12345678' }))).toBe('abc-12345678')
    const made = requestIdFrom(new Headers({ 'x-request-id': '<script>' }))
    expect(made).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('errors and status codes', () => {
  const log = createLogger('fn', 'req-12345678', () => {})

  it('maps HttpError to its status, code and headers', async () => {
    const r = errorResponse(new HttpError(429, 'rate_limited', { retry_after: 30 }, { 'Retry-After': '30' }), log, {})
    expect(r.status).toBe(429)
    expect(r.headers.get('retry-after')).toBe('30')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(r.headers.get('x-api-version')).toBe('1')
    expect(await r.json()).toMatchObject({ error: 'rate_limited', retry_after: 30, request_id: 'req-12345678' })
  })

  it('never leaks internal error text', async () => {
    const r = errorResponse(new Error('relation "secret_table" does not exist'), log, {})
    expect(r.status).toBe(500)
    const body = await r.json()
    expect(body.error).toBe('server_error')
    expect(JSON.stringify(body)).not.toContain('secret_table')
  })

  it('refuses unknown API versions', () => {
    expect(() => checkApiVersion(new Headers({ 'x-api-version': '2' }))).toThrow(HttpError)
    expect(() => checkApiVersion(new Headers({ 'x-api-version': '1' }))).not.toThrow()
    expect(() => checkApiVersion(new Headers())).not.toThrow()
  })
})

describe('input', () => {
  const req = (body: string, headers: Record<string, string> = {}) => new Request('http://x', { method: 'POST', body, headers })

  it('reads a JSON object', async () => {
    expect(await readJson(req('{"a":1}'), 100)).toEqual({ a: 1 })
  })

  it('rejects oversized, invalid and non-object bodies', async () => {
    await expect(readJson(req('{"a":"' + 'x'.repeat(200) + '"}'), 100)).rejects.toMatchObject({ status: 413 })
    await expect(readJson(req('{}', { 'content-length': '999999' }), 100)).rejects.toMatchObject({ status: 413 })
    await expect(readJson(req('not json'), 100)).rejects.toMatchObject({ status: 400, code: 'invalid_json' })
    await expect(readJson(req('[1,2]'), 100)).rejects.toMatchObject({ code: 'invalid_json' })
  })

  it('takes the first forwarded IP', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4')
    expect(clientIp(new Headers())).toBe('unknown')
  })

  it('compares secrets in constant time', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('CORS', () => {
  it('allows any origin without an allow-list', () => {
    expect(corsHeaders('https://evil.example', undefined)['Access-Control-Allow-Origin']).toBe('*')
  })
  it('echoes only listed origins', () => {
    const list = 'https://app.example.de,https://admin.example.de'
    expect(corsHeaders('https://admin.example.de', list)['Access-Control-Allow-Origin']).toBe('https://admin.example.de')
    expect(corsHeaders('https://evil.example', list)['Access-Control-Allow-Origin']).toBe('https://app.example.de')
  })
})

describe('timeouts, backoff and retries', () => {
  it('backoff grows exponentially, is capped and jittered', () => {
    expect(backoffDelay(0, 500, 8000, () => 0.999)).toBe(499)
    expect(backoffDelay(3, 500, 8000, () => 0.999)).toBe(3996)
    expect(backoffDelay(10, 500, 8000, () => 0.999)).toBe(7992)
    expect(backoffDelay(5, 500, 8000, () => 0)).toBe(0)
  })

  it('parses Retry-After seconds and dates', () => {
    expect(retryAfterMs('3')).toBe(3000)
    expect(retryAfterMs(new Date(10_000).toUTCString(), 4_000)).toBe(6000)
    expect(retryAfterMs('soon')).toBeNull()
  })

  it('aborts a hanging request', async () => {
    const hang: typeof fetch = (_u, init) =>
      new Promise((_, reject) => (init?.signal as AbortSignal).addEventListener('abort', () => reject(new Error('aborted'))))
    await expect(fetchWithTimeout('http://x', {}, 20, hang)).rejects.toBeInstanceOf(TimeoutError)
  })

  it('retries 5xx and 429 (honouring Retry-After), then succeeds', async () => {
    const answers = [res(503), res(429, { 'retry-after': '2' }), res(200)]
    const fetchImpl = vi.fn(async () => answers.shift()!)
    const waits: number[] = []
    const r = await fetchWithRetry('http://x', {}, { fetchImpl: fetchImpl as unknown as typeof fetch, sleepImpl: async (ms) => void waits.push(ms), random: () => 0.5 })
    expect(r.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(waits).toEqual([250, 2000])
  })

  it('does not retry client errors and gives up after the retry budget', async () => {
    const f400 = vi.fn(async () => res(400))
    expect((await fetchWithRetry('http://x', {}, { fetchImpl: f400 as unknown as typeof fetch, sleepImpl: async () => {} })).status).toBe(400)
    expect(f400).toHaveBeenCalledTimes(1)
    const f500 = vi.fn(async () => res(500))
    expect((await fetchWithRetry('http://x', {}, { retries: 2, fetchImpl: f500 as unknown as typeof fetch, sleepImpl: async () => {} })).status).toBe(500)
    expect(f500).toHaveBeenCalledTimes(3)
  })

  it('retries network errors and rethrows the last one', async () => {
    const boom = vi.fn(async () => {
      throw new Error('ECONNRESET')
    })
    await expect(fetchWithRetry('http://x', {}, { retries: 1, fetchImpl: boom as unknown as typeof fetch, sleepImpl: async () => {} })).rejects.toThrow('ECONNRESET')
    expect(boom).toHaveBeenCalledTimes(2)
  })
})

describe('circuit breaker', () => {
  it('opens after repeated failures, half-opens after the cooldown, closes on success', () => {
    let t = 0
    const b = new CircuitBreaker('resend', 3, 1000, () => t)
    b.failure()
    b.failure()
    expect(b.canRequest()).toBe(true)
    b.failure()
    expect(b.state).toBe('open')
    expect(b.canRequest()).toBe(false)
    t = 400
    expect(b.retryInMs()).toBe(600)
    t = 1000
    expect(b.state).toBe('half_open')
    b.failure() // trial call failed → open again
    expect(b.state).toBe('open')
    t = 2100
    expect(b.canRequest()).toBe(true)
    b.success()
    expect(b.state).toBe('closed')
  })
})
