/**
 * Shared HTTP plumbing for every edge function.
 *
 * Pure TypeScript with no Deno-only imports, so the same file runs in the
 * Supabase Edge Runtime (Deno) and in the app's Vitest suite (Node).
 *
 *   - request ids + structured JSON logs (one line per event, secrets redacted)
 *   - typed HTTP errors → consistent JSON error bodies and status codes
 *   - CORS allow-list, security headers, API version header
 *   - body size limit while reading JSON
 *   - fetch with timeout, exponential backoff with full jitter, Retry-After
 *   - a small circuit breaker for outbound providers
 *   - client IP + constant-time compare helpers
 */

export const API_VERSION = '1'
export const SUPPORTED_API_VERSIONS = new Set(['1'])

// ── errors ──────────────────────────────────────────────────────────────────

/** An error that maps to an HTTP response. `code` is a stable, machine-readable string. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public extra: Record<string, unknown> = {},
    public headers: Record<string, string> = {},
  ) {
    super(code)
  }
}

export const badRequest = (code = 'invalid_input', extra?: Record<string, unknown>) => new HttpError(400, code, extra)
export const unauthorized = (code = 'unauthenticated') => new HttpError(401, code)
export const forbidden = (code = 'forbidden') => new HttpError(403, code)
export const notFound = (code = 'not_found') => new HttpError(404, code)
export const conflict = (code = 'conflict', extra?: Record<string, unknown>) => new HttpError(409, code, extra)
export const tooLarge = (code = 'too_large') => new HttpError(413, code)
export const tooMany = (retryAfterSec: number, code = 'rate_limited') =>
  new HttpError(429, code, { retry_after: retryAfterSec }, { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSec))) })
export const unavailable = (code = 'service_unavailable', retryAfterSec = 30) =>
  new HttpError(503, code, {}, { 'Retry-After': String(retryAfterSec) })

// ── logging ─────────────────────────────────────────────────────────────────

const SECRET_KEYS = /pass(word)?|secret|token|authorization|api[-_]?key|cookie|signature|service[-_]?role/i

/** Masks an e-mail so logs stay useful without storing the full address (GDPR). */
export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 1) return '***'
  return `${email[0]}***${email.slice(at)}`
}

/** Deep-copies a value for logging: secrets become "[redacted]", e-mails are masked, long strings cut. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]'
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const s = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? maskEmail(value) : value
    return s.length > 300 ? `${s.slice(0, 300)}…` : s
  }
  if (value instanceof Error) return { name: value.name, message: String(value.message).slice(0, 300) }
  if (Array.isArray(value)) return value.length > 20 ? [...value.slice(0, 20).map((v) => redact(v, depth + 1)), `…+${value.length - 20}`] : value.map((v) => redact(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = SECRET_KEYS.test(k) ? '[redacted]' : redact(v, depth + 1)
    return out
  }
  return String(value)
}

export type Level = 'debug' | 'info' | 'warn' | 'error'
export interface Logger {
  requestId: string
  log(level: Level, msg: string, fields?: Record<string, unknown>): void
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string, fields?: Record<string, unknown>): void
  /** Milliseconds since the request started. */
  elapsed(): number
}

/** Structured JSON logger. Every line carries the function name and request id (trace id). */
export function createLogger(fn: string, requestId: string, sink: (line: string) => void = (l) => console.log(l), now = () => Date.now()): Logger {
  const started = now()
  const log = (level: Level, msg: string, fields: Record<string, unknown> = {}) => {
    sink(JSON.stringify({ ts: new Date(now()).toISOString(), level, fn, request_id: requestId, msg, ...(redact(fields) as object) }))
  }
  return {
    requestId,
    log,
    info: (m, f) => log('info', m, f),
    warn: (m, f) => log('warn', m, f),
    error: (m, f) => log('error', m, f),
    elapsed: () => now() - started,
  }
}

const REQ_ID_RE = /^[A-Za-z0-9._-]{8,80}$/

/** Reuses a caller's x-request-id (distributed tracing across app → function → provider) or makes one. */
export function requestIdFrom(headers: Headers): string {
  const given = headers.get('x-request-id') ?? headers.get('x-correlation-id')
  if (given && REQ_ID_RE.test(given)) return given
  return crypto.randomUUID()
}

// ── responses ───────────────────────────────────────────────────────────────

/** CORS: echo the origin when it is on ALLOWED_ORIGINS (comma list); '*' when no list is set. Native apps send no Origin. */
export function corsHeaders(origin: string | null, allowed: string | undefined, extraHeaders = ''): Record<string, string> {
  const list = (allowed ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const allowOrigin = !list.length ? '*' : origin && list.includes(origin) ? origin : list[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': `authorization, x-client-info, apikey, content-type, x-request-id, x-api-version, idempotency-key${extraHeaders ? `, ${extraHeaders}` : ''}`,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Expose-Headers': 'x-request-id, x-api-version, retry-after',
    'Access-Control-Max-Age': '600',
    ...(list.length ? { Vary: 'Origin' } : {}),
  }
}

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
}

export function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...SECURITY_HEADERS, ...headers, 'Content-Type': 'application/json; charset=utf-8', 'X-API-Version': API_VERSION },
  })
}

/** Turns anything thrown into a response. Unknown errors become a generic 500 — internals never reach the client. */
export function errorResponse(e: unknown, log: Logger, headers: Record<string, string>): Response {
  if (e instanceof HttpError) {
    if (e.status >= 500) log.error('request failed', { status: e.status, code: e.code })
    else log.info('request rejected', { status: e.status, code: e.code })
    return jsonResponse({ error: e.code, request_id: log.requestId, ...e.extra }, e.status, { ...headers, ...e.headers })
  }
  log.error('unhandled error', { error: e })
  return jsonResponse({ error: 'server_error', request_id: log.requestId }, 500, headers)
}

// ── input ───────────────────────────────────────────────────────────────────

/** Reads a JSON object body with a hard byte limit (content-length can be missing or wrong). */
export async function readJson(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > maxBytes) throw tooLarge()
  const buf = new Uint8Array(await req.arrayBuffer())
  if (buf.byteLength > maxBytes) throw tooLarge()
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buf))
  } catch {
    throw badRequest('invalid_json')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw badRequest('invalid_json')
  return parsed as Record<string, unknown>
}

/** API versioning: clients may send x-api-version; unknown majors are refused instead of half-working. */
export function checkApiVersion(headers: Headers) {
  const v = headers.get('x-api-version')
  if (v && !SUPPORTED_API_VERSIONS.has(v.split('.')[0])) throw badRequest('unsupported_api_version', { supported: [...SUPPORTED_API_VERSIONS] })
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return (fwd || headers.get('cf-connecting-ip') || headers.get('x-real-ip') || 'unknown').slice(0, 64)
}

/** Compares secrets without leaking their length/prefix through timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

// ── resilience ──────────────────────────────────────────────────────────────

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Exponential backoff with "full jitter": random in [0, min(cap, base·2^attempt)]. */
export function backoffDelay(attempt: number, baseMs = 500, capMs = 8000, random = Math.random): number {
  const ceiling = Math.min(capMs, baseMs * 2 ** attempt)
  return Math.floor(random() * ceiling)
}

/** Parses Retry-After (seconds or HTTP date) into ms; null when absent/invalid. */
export function retryAfterMs(value: string | null, now = Date.now()): number | null {
  if (!value) return null
  const secs = Number(value)
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000)
  const at = Date.parse(value)
  return Number.isFinite(at) ? Math.max(0, at - now) : null
}

export class TimeoutError extends Error {
  constructor(public ms: number) {
    super(`timeout after ${ms} ms`)
  }
}

/** fetch() that aborts after `timeoutMs`. */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10_000, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal })
  } catch (e) {
    if (ctrl.signal.aborted) throw new TimeoutError(timeoutMs)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export interface RetryOptions {
  retries?: number
  timeoutMs?: number
  baseMs?: number
  capMs?: number
  /** Status codes worth retrying. 4xx other than 408/429 are the caller's fault — never retried. */
  retryOn?: (status: number) => boolean
  fetchImpl?: typeof fetch
  sleepImpl?: (ms: number) => Promise<void>
  random?: () => number
  onRetry?: (info: { attempt: number; delayMs: number; reason: string }) => void
}

const defaultRetryOn = (s: number) => s === 408 || s === 429 || s >= 500

/**
 * fetch with timeout + retries (exponential backoff, full jitter, honours Retry-After).
 * Only use it for idempotent requests, or ones protected by an idempotency key.
 */
export async function fetchWithRetry(url: string, init: RequestInit = {}, opts: RetryOptions = {}): Promise<Response> {
  const { retries = 3, timeoutMs = 10_000, baseMs = 500, capMs = 8000, retryOn = defaultRetryOn, fetchImpl = fetch, sleepImpl = sleep, random = Math.random, onRetry } = opts
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null
    let reason = ''
    try {
      res = await fetchWithTimeout(url, init, timeoutMs, fetchImpl)
      if (!retryOn(res.status) || attempt >= retries) return res
      reason = `status_${res.status}`
    } catch (e) {
      if (attempt >= retries) throw e
      reason = e instanceof TimeoutError ? 'timeout' : 'network'
    }
    const hinted = res ? retryAfterMs(res.headers.get('retry-after')) : null
    const delayMs = hinted !== null ? Math.min(hinted, capMs * 4) : backoffDelay(attempt, baseMs, capMs, random)
    onRetry?.({ attempt: attempt + 1, delayMs, reason })
    await sleepImpl(delayMs)
  }
}

export type BreakerState = 'closed' | 'open' | 'half_open'

/**
 * Circuit breaker: after `threshold` consecutive failures calls are refused for
 * `cooldownMs` (fail fast instead of piling up timeouts), then one trial call
 * decides whether to close again. State lives per function instance.
 */
export class CircuitBreaker {
  private failures = 0
  private openedAt = 0
  private state_: BreakerState = 'closed'
  constructor(
    public name: string,
    private threshold = 3,
    private cooldownMs = 60_000,
    private now = () => Date.now(),
  ) {}

  get state(): BreakerState {
    if (this.state_ === 'open' && this.now() - this.openedAt >= this.cooldownMs) this.state_ = 'half_open'
    return this.state_
  }

  /** True when a call may go through right now. */
  canRequest(): boolean {
    return this.state !== 'open'
  }

  success() {
    this.failures = 0
    this.state_ = 'closed'
  }

  failure() {
    this.failures++
    if (this.state_ === 'half_open' || this.failures >= this.threshold) {
      this.state_ = 'open'
      this.openedAt = this.now()
    }
  }

  /** Remaining open time in ms (0 when calls are allowed). */
  retryInMs(): number {
    return this.state === 'open' ? this.cooldownMs - (this.now() - this.openedAt) : 0
  }
}
