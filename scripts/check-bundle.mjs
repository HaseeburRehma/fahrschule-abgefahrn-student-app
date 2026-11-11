#!/usr/bin/env node
// Performance budget + secret scan for the web export (run after `expo export`).
//   node scripts/check-bundle.mjs [distDir]
// Fails when the JavaScript grows past the budget (gzip size is what users
// download) or when anything that looks like a server secret ends up in it.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const dist = process.argv[2] ?? 'dist'
const BUDGET = { jsRawBytes: 4_400_000, jsGzipBytes: 1_150_000, totalBytes: 16_000_000 }
const SECRET_PATTERNS = [
  /re_[A-Za-z0-9]{20,}/, // Resend API key
  /sb_secret_[A-Za-z0-9_-]{10,}/, // Supabase secret key
  /"role"\s*:\s*"service_role"/, // legacy service-role JWT payload
  /SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
]

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const files = walk(dist)
const js = files.filter((f) => f.endsWith('.js'))
let raw = 0
let gz = 0
let total = 0
const leaks = []
for (const f of files) total += statSync(f).size
for (const f of js) {
  const buf = readFileSync(f)
  raw += buf.length
  gz += gzipSync(buf, { level: 9 }).length
  const text = buf.toString('utf8')
  for (const re of SECRET_PATTERNS) if (re.test(text)) leaks.push(`${f}: ${re}`)
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`
console.log(`JS raw ${kb(raw)} / ${kb(BUDGET.jsRawBytes)} · JS gzip ${kb(gz)} / ${kb(BUDGET.jsGzipBytes)} · total ${kb(total)} / ${kb(BUDGET.totalBytes)}`)
const over = []
if (raw > BUDGET.jsRawBytes) over.push('JS raw')
if (gz > BUDGET.jsGzipBytes) over.push('JS gzip')
if (total > BUDGET.totalBytes) over.push('total')
if (leaks.length) console.error(`Possible secrets in the bundle:\n${leaks.join('\n')}`)
if (over.length) console.error(`Performance budget exceeded: ${over.join(', ')}`)
process.exit(leaks.length || over.length ? 1 : 0)
