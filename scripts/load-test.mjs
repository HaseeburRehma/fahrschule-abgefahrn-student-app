#!/usr/bin/env node
// Tiny HTTP load tester (no dependencies).
//   node scripts/load-test.mjs <url> [requests=500] [concurrency=25] [header=value ...]
// Prints throughput, latency percentiles and the status-code mix. Only point it
// at systems you own; the Vercel CDN and Supabase have their own rate limits.
const [url, nArg = '500', cArg = '25', ...hdrArgs] = process.argv.slice(2)
if (!url) {
  console.error('usage: load-test.mjs <url> [requests] [concurrency] [Header=value ...]')
  process.exit(2)
}
const total = Number(nArg)
const concurrency = Number(cArg)
const headers = Object.fromEntries(hdrArgs.map((h) => [h.slice(0, h.indexOf('=')), h.slice(h.indexOf('=') + 1)]))

const times = []
const codes = {}
let next = 0
let errors = 0
const started = performance.now()

async function worker() {
  while (next < total) {
    next++
    const t0 = performance.now()
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) })
      await res.arrayBuffer()
      codes[res.status] = (codes[res.status] ?? 0) + 1
    } catch {
      errors++
    }
    times.push(performance.now() - t0)
  }
}
await Promise.all(Array.from({ length: concurrency }, worker))
const secs = (performance.now() - started) / 1000
times.sort((a, b) => a - b)
const pct = (p) => times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))].toFixed(0)
console.log(JSON.stringify({ url, requests: total, concurrency, seconds: +secs.toFixed(2), rps: +(total / secs).toFixed(1), p50_ms: +pct(50), p95_ms: +pct(95), p99_ms: +pct(99), max_ms: +times.at(-1).toFixed(0), codes, network_errors: errors }, null, 2))
