#!/usr/bin/env node
// Dependency vulnerability gate: fails on any high/critical advisory in
// production dependencies unless it is in security/audit-allowlist.json with a
// reason and a not-yet-expired date.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

let report
try {
  report = JSON.parse(execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
} catch (e) {
  report = JSON.parse(e.stdout) // npm audit exits non-zero when it finds anything
}
const allow = JSON.parse(readFileSync(new URL('../security/audit-allowlist.json', import.meta.url), 'utf8')).accepted
const today = new Date().toISOString().slice(0, 10)
const problems = []
const seen = new Set()
for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of v.via) {
    if (typeof via !== 'object' || !['high', 'critical'].includes(via.severity)) continue
    const id = via.url.split('/').pop()
    if (seen.has(id)) continue
    seen.add(id)
    const ok = allow.find((a) => a.id === id)
    if (!ok) problems.push(`${via.severity.toUpperCase()} ${name}: ${via.title} (${via.url})`)
    else if (ok.expires < today) problems.push(`EXPIRED acceptance for ${id} (${name}) — re-review it`)
    else console.log(`accepted ${id} ${name} until ${ok.expires}`)
  }
}
const m = report.metadata?.vulnerabilities ?? {}
console.log(`prod deps: ${m.critical ?? 0} critical, ${m.high ?? 0} high, ${m.moderate ?? 0} moderate, ${m.low ?? 0} low`)
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
