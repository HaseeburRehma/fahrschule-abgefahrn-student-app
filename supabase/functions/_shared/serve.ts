// @ts-nocheck — Deno-only wrapper (Deno.serve, Deno.env, EdgeRuntime). Checked by `deno check`.
/**
 * `serve(name, options, handler)` — the entry point every edge function uses.
 *
 * It gives each request: a request id (tracing), a structured logger, CORS,
 * method + API-version checks, one access-log line with status and duration,
 * error → status-code mapping (internals are never sent to the client),
 * and graceful shutdown logging when the runtime recycles the instance.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0'
import {
  type Logger,
  forbidden,
  unauthorized,
  HttpError,
  checkApiVersion,
  clientIp,
  corsHeaders,
  createLogger,
  errorResponse,
  jsonResponse,
  requestIdFrom,
  tooMany,
} from './http.ts'

export interface Ctx {
  req: Request
  log: Logger
  ip: string
  /** Builds a JSON response with CORS + security headers. */
  json(body: unknown, status?: number): Response
  env(name: string): string | undefined
  /** Runs work after the response is sent (EdgeRuntime.waitUntil), e.g. audit writes. */
  background(p: Promise<unknown>): void
}

export interface ServeOptions {
  /** Extra request headers allowed by CORS (e.g. 'x-intake-secret'). */
  corsExtraHeaders?: string
  methods?: string[]
}

let inFlight = 0
let shutdownHooked = false

function hookShutdown(name: string) {
  if (shutdownHooked) return
  shutdownHooked = true
  // The Edge Runtime fires `beforeunload` before it stops an idle or recycled
  // instance. Log it (with requests still running) so cut-off work is visible.
  globalThis.addEventListener?.('beforeunload', (ev: any) => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', fn: name, msg: 'shutdown', reason: ev?.detail?.reason ?? 'unknown', in_flight: inFlight }))
  })
}

export function serve(name: string, options: ServeOptions, handler: (ctx: Ctx) => Promise<Response>) {
  hookShutdown(name)
  const methods = options.methods ?? ['POST']
  Deno.serve(async (req: Request) => {
    const requestId = requestIdFrom(req.headers)
    const log = createLogger(name, requestId)
    const cors = { ...corsHeaders(req.headers.get('origin'), Deno.env.get('ALLOWED_ORIGINS'), options.corsExtraHeaders), 'X-Request-Id': requestId }
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    inFlight++
    let res: Response
    try {
      if (!methods.includes(req.method)) throw new HttpError(405, 'method_not_allowed', {}, { Allow: methods.join(', ') })
      checkApiVersion(req.headers)
      const ctx: Ctx = {
        req,
        log,
        ip: clientIp(req.headers),
        json: (body, status = 200) => jsonResponse(body, status, cors),
        env: (n) => Deno.env.get(n),
        background: (p) => {
          const guarded = p.catch((e) => log.error('background task failed', { error: e }))
          // deno-lint-ignore no-explicit-any
          const rt = (globalThis as any).EdgeRuntime
          if (rt?.waitUntil) rt.waitUntil(guarded)
        },
      }
      res = await handler(ctx)
    } catch (e) {
      res = errorResponse(e, log, cors)
    } finally {
      inFlight--
    }
    log.info('request', { method: req.method, status: res.status, duration_ms: log.elapsed() })
    return res
  })
}

/**
 * Shared fixed-window rate limit backed by Postgres (public.check_rate_limit),
 * so it holds across all function instances. Fails open (logs a warning) if
 * the database call itself fails — availability over strictness.
 */
export async function enforceRateLimit(admin: any, log: Logger, key: string, limit: number, windowSeconds: number) {
  const { data, error } = await admin.rpc('check_rate_limit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds })
  if (error) {
    log.warn('rate limit check failed (fail open)', { key, error: error.message })
    return
  }
  const row = Array.isArray(data) ? data[0] : data
  if (row && row.allowed === false) throw tooMany(row.retry_after ?? windowSeconds)
}

// ── auth helpers ────────────────────────────────────────────────────────────

/** Service-role client (bypasses RLS) — only after the caller is authorised. */
export function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Verifies the caller's JWT with Supabase Auth (signature, expiry, revoked
 * sessions) and returns the user plus a client that acts AS the caller (RLS applies).
 */
export async function authenticate(ctx: Ctx) {
  const authHeader = ctx.req.headers.get('Authorization') ?? ''
  if (!/^Bearer\s+\S+$/.test(authHeader)) throw unauthorized('missing_authorization')
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await caller.auth.getUser()
  if (error || !data?.user) throw unauthorized('unauthenticated')
  return { user: data.user, caller }
}

/** authenticate() + RBAC: the caller must be an active admin (public.is_admin()). */
export async function requireAdmin(ctx: Ctx) {
  const auth = await authenticate(ctx)
  const { data: isAdmin, error } = await auth.caller.rpc('is_admin')
  if (error) {
    ctx.log.error('is_admin check failed', { error: error.message })
    throw new HttpError(500, 'auth_check_failed')
  }
  if (!isAdmin) throw forbidden()
  return auth
}

/**
 * GDPR erasure: removes every stored file of a student (documents bucket,
 * students/<uid>/…) before the account itself is deleted.
 */
export async function purgeStudentFiles(admin: any, log: Logger, uid: string) {
  const bucket = admin.storage.from('documents')
  const paths: string[] = []
  const walk = async (prefix: string, depth: number) => {
    const { data, error } = await bucket.list(prefix, { limit: 1000 })
    if (error) throw error
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`
      if (item.id) paths.push(path)
      else if (depth < 3) await walk(path, depth + 1)
    }
  }
  await walk(`students/${uid}`, 0)
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await bucket.remove(paths.slice(i, i + 100))
    if (error) throw error
  }
  log.info('student files purged', { count: paths.length })
}
