#!/usr/bin/env node
// Black-box security probe (read-only) against a deployed environment.
//   EXPO_PUBLIC_SUPABASE_URL=… EXPO_PUBLIC_SUPABASE_ANON_KEY=… WEB_URL=… node scripts/security-probe.mjs
// Uses only the public anon key — what any attacker has. It never writes data
// (all POST probes are rejected before anything is created) and never signs in.
const API = process.env.EXPO_PUBLIC_SUPABASE_URL
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const WEB = process.env.WEB_URL ?? 'https://fahrschule-abgefahrn-student-app.vercel.app'
if (!API || !KEY) {
  console.error('set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(2)
}
const H = { apikey: KEY, 'content-type': 'application/json' }
const results = []
const check = (area, name, pass, detail = '') => results.push({ area, name, pass, detail })
const get = (p, h = H) => fetch(`${API}${p}`, { headers: h }).then(async (r) => ({ s: r.status, t: await r.text(), h: r.headers }))
const post = (p, body, h = H) => fetch(`${API}${p}`, { method: 'POST', headers: h, body: JSON.stringify(body) }).then(async (r) => ({ s: r.status, t: await r.text(), h: r.headers }))

// 1. Row level security: anonymous reads return nothing.
const TABLES = ['profiles', 'student_invites', 'student_imports', 'app_settings', 'audit_log', 'quiz_attempts', 'chat_messages', 'documents', 'notifications', 'appointments', 'signup_intake', 'rate_limits', 'webhook_events', 'student_packages', 'topic_progress']
for (const t of TABLES) {
  const r = await get(`/rest/v1/${t}?select=*&limit=1`)
  const empty = r.s === 200 && r.t.trim() === '[]'
  check('RLS', `anon read ${t}`, empty || r.s === 401 || r.s === 403 || r.s === 404 || /42501|PGRST205/.test(r.t), `${r.s} ${r.t.slice(0, 60)}`)
}
// 2. SQL injection through PostgREST filters is parameterised.
{
  const r = await get(`/rest/v1/profiles?select=id&email=eq.${encodeURIComponent("x' or '1'='1")}`)
  check('SQL injection', 'filter value is a parameter, not SQL', r.s === 200 && r.t.trim() === '[]', `${r.s}`)
  const r2 = await get(`/rest/v1/profiles?select=id&order=${encodeURIComponent('id;drop table profiles')}`)
  check('SQL injection', 'order clause rejected', r2.s >= 400, `${r2.s}`)
}
// 3. Privileged RPCs refuse anonymous callers.
for (const fn of ['admin_student_performance', 'new_student_code', 'check_rate_limit', 'is_admin']) {
  const r = await post(`/rest/v1/rpc/${fn}`, fn === 'check_rate_limit' ? { p_key: 'x', p_limit: 1, p_window_seconds: 1 } : {})
  const ok = fn === 'is_admin' ? r.t.trim() === 'false' || r.s === 401 || /42501/.test(r.t) : r.s === 401 || r.s === 403 || r.s === 404 || /42501|PGRST202/.test(r.t)
  check('RBAC', `anon rpc ${fn}`, ok, `${r.s} ${r.t.slice(0, 60)}`)
}
// 4. Edge functions: no JWT → 401, junk → 4xx (never 500 / stack traces).
for (const fn of ['admin-invite-students', 'admin-create-student', 'admin-delete-student', 'delete-account']) {
  const r = await post(`/functions/v1/${fn}`, { action: 'send', invite_ids: [] }, { 'content-type': 'application/json' })
  check('AuthN', `${fn} without token`, r.s === 401 || r.s === 404, `${r.s}${r.s === 404 ? ' (not deployed)' : ''}`)
}
{
  const r = await post(`/functions/v1/push-dispatch`, { type: 'INSERT', record: { id: 'x' } })
  check('Webhooks', 'push-dispatch without secret', r.s === 401 || r.s === 503, `${r.s}`)
  const r2 = await post(`/functions/v1/signup-with-code`, { email: '<script>@x', password: 'x' })
  check('Input validation', 'signup-with-code rejects junk', r2.s === 400 || r2.s === 429, `${r2.s} ${r2.t.slice(0, 50)}`)
  check('Error handling', 'no stack traces in errors', !/at\s+\S+\s+\(|Error:\s.*\n\s+at /.test(r2.t))
}
// 5. Storage: private buckets can't be listed anonymously.
for (const b of ['documents', 'student-imports']) {
  const r = await post(`/storage/v1/object/list/${b}`, { prefix: '', limit: 5 })
  check('Storage', `anon list ${b}`, r.s >= 400 || r.t.trim() === '[]', `${r.s} ${r.t.slice(0, 50)}`)
}
// 6. Web app: TLS, security headers, clickjacking, open redirect, path traversal.
{
  const http = await fetch(WEB.replace('https://', 'http://'), { redirect: 'manual' })
  check('TLS', 'http → https redirect', http.status >= 300 && http.status < 400 && (http.headers.get('location') ?? '').startsWith('https://'), `${http.status}`)
  const r = await fetch(WEB)
  const need = { 'strict-transport-security': /max-age=\d{7,}/, 'content-security-policy': /frame-ancestors 'none'/, 'x-frame-options': /DENY/i, 'x-content-type-options': /nosniff/, 'referrer-policy': /./, 'permissions-policy': /camera=\(\)/ }
  for (const [h, re] of Object.entries(need)) check('Headers', h, re.test(r.headers.get(h) ?? ''), (r.headers.get(h) ?? 'missing').slice(0, 60))
  const red = await fetch(`${WEB}/?redirect=https://evil.example&next=//evil.example&returnTo=https://evil.example`, { redirect: 'manual' })
  check('Open redirect', 'redirect/next params ignored', red.status === 200 && !red.headers.get('location'), `${red.status}`)
  const trav = await fetch(`${WEB}/..%2f..%2f..%2fetc%2fpasswd`)
  check('Path traversal', 'no file disclosure', !(await trav.text()).includes('root:'), `${trav.status}`)
}

const pad = (s, n) => String(s).padEnd(n)
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${pad(r.area, 16)} ${pad(r.name, 42)} ${r.detail}`)
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
