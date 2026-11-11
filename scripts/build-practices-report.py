#!/usr/bin/env python3
"""
Builds docs/engineering-practices.pdf — every engineering concept on the list,
explained, with how and where it is applied in this project.

    python3 scripts/build-practices-report.py      (needs Google Chrome for the PDF)

Status tags
  CODE      implemented in this repository (file paths given)
  PLATFORM  provided by the managed platform (Supabase, Vercel, Expo/EAS, stores)
  PROCESS   a documented practice / runbook in this repo
  PLANNED   not done yet, with the reason and the plan
"""
import html
import os
import shutil
import subprocess
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_HTML = os.path.join(ROOT, 'docs', 'engineering-practices.html')
OUT_PDF = os.path.join(ROOT, 'docs', 'engineering-practices.pdf')

# (concept, what it means, how it is applied here, status, where)
S = [
 ("1 · Architecture, scaling & infrastructure", [
  ("Load balancing", "Spreading requests over many servers so none is overloaded.",
   "Supabase's gateway balances API, Auth, Storage and edge-function traffic over its instances; Vercel's edge network serves the web app from the nearest location. We run no servers of our own that would need a balancer.",
   "PLATFORM", "docs/OPERATIONS.md (Architecture)"),
  ("Reverse proxies", "A server in front of the app that terminates TLS, routes and filters requests.",
   "Kong (Supabase) and Vercel's edge sit in front of everything. For self-hosting, the Docker image ships nginx as reverse proxy/static server with the same security headers, gzip, health endpoint and SPA routing.",
   "CODE", "deploy/nginx.conf, Dockerfile"),
  ("API gateways", "One entry point that authenticates, rate-limits and routes API calls.",
   "Supabase's Kong gateway checks the API key and (per function) the JWT before a request reaches PostgREST or a function; per-function JWT verification is declared in config. Our functions add their own rate limits and RBAC behind it.",
   "PLATFORM", "supabase/config.toml"),
  ("CDNs", "Caching static files on servers close to users.",
   "Web build is served from Vercel's CDN. Hashed bundles and assets are cached for a year (immutable); index.html/SPA routes are always revalidated so a new deploy reaches users immediately.",
   "CODE", "vercel.json, deploy/nginx.conf"),
  ("Horizontal vs vertical scaling", "Horizontal = more machines; vertical = a bigger machine.",
   "Edge functions and the static web app scale horizontally automatically (stateless). Postgres scales vertically (Supabase compute add-ons) and horizontally for reads with replicas. Measured headroom: 2,000 students / 100k quiz rounds → admin dashboard RPC 80 ms; 10 parallel admins 192 ms avg.",
   "PLATFORM", "docs/OPERATIONS.md (Scaling)"),
  ("Stateless services", "Servers keep no session state, so any instance can answer any request.",
   "Every edge function keeps state only in Postgres (rate limits, idempotency keys, webhook dedupe, retry queue). The only in-memory state — circuit breaker and a fallback throttle — is an optimisation that is safe to lose.",
   "CODE", "supabase/functions/_shared/serve.ts"),
  ("Read replicas", "Copies of the database that serve read-only queries.",
   "Not needed at the current size (one school, ~80 students). Supabase offers replicas on Pro+; the heavy read path (admin performance RPC) is isolated in one function, so it can be pointed at a replica later.",
   "PLANNED", "docs/OPERATIONS.md (Scaling)"),
  ("Connection pooling", "Re-using a few database connections for many requests.",
   "The app and functions talk to Postgres over HTTP (PostgREST), which keeps a pool; Supabase's Supavisor pools direct connections. pgbench with 50 parallel clients ran without connection errors.",
   "PLATFORM", "scripts/db-load.sh"),
  ("Docker", "Packaging an app with everything it needs into a portable image.",
   "Multi-stage Dockerfile: Node builds the web export, an unprivileged nginx serves it (healthcheck, STOPSIGNAL SIGQUIT). CI builds the image and smoke-tests health + headers on every push.",
   "CODE", "Dockerfile, .github/workflows/ci.yml"),
  ("CI/CD", "Automatic test (CI) and delivery (CD) on every change.",
   "GitHub Actions: typecheck, 93 unit tests, dependency gate, web export + bundle budget, Deno lint/check of all functions, all migrations + SQL security tests on Postgres 17, Docker build. CD: Vercel deploys main; EAS ships OTA updates and store builds.",
   "CODE", ".github/workflows/ci.yml"),
  ("Infrastructure as code", "Infrastructure described in versioned files instead of clicks.",
   "Database schema, RLS, cron jobs, buckets: supabase/migrations. Function auth: supabase/config.toml. Hosting + headers: vercel.json. Build profiles: eas.json. CI/monitoring: .github/. Self-host: Dockerfile + nginx.conf.",
   "CODE", "supabase/, vercel.json, eas.json, .github/"),
  ("Message queues", "A durable list of jobs processed asynchronously.",
   "Failed invite e-mails form a queue in Postgres (status failed + next_attempt_at, indexed) — the transactional outbox pattern; a worker drains it. A separate broker (RabbitMQ/SQS) would add cost without benefit at this scale.",
   "CODE", "migrations/20261111000001, admin-invite-students (retry)"),
  ("Background jobs", "Work done outside the user's request.",
   "Retry worker re-sends failed invites every 10 min (pg_cron → pg_net → function). Push notifications are sent by a database trigger → push-dispatch. Functions can defer work with EdgeRuntime.waitUntil (ctx.background).",
   "CODE", "supabase/scripts/schedule_invite_retry.sql, _shared/serve.ts"),
  ("Cron jobs", "Tasks on a schedule.",
   "pg_cron: purge rate-limit windows (hourly), webhook dedupe (daily), minimise old import data after 180 days (daily), audit-log retention 2 years (weekly). Uptime check every 15 min in GitHub Actions.",
   "CODE", "migrations/20261111000001 §7, .github/workflows/uptime.yml"),
  ("Webhooks", "A service calls our URL when something happens.",
   "Inbound: Resend delivery events (Svix HMAC signature, 5-min replay window, dedupe by event id), database → push-dispatch (shared secret, constant-time compare, row re-read, once-only), website form → intake-signup (secret).",
   "CODE", "resend-webhook, push-dispatch, intake-signup"),
  ("Graceful shutdown", "Finish running work before a process stops.",
   "Edge runtime: we log the beforeunload event with the number of in-flight requests; background work is registered with waitUntil so the runtime waits for it. nginx in Docker stops with SIGQUIT (finishes open requests).",
   "CODE", "_shared/serve.ts, Dockerfile"),
 ]),
 ("2 · Reliability & resilience", [
  ("Timeouts", "Never wait forever on another system.",
   "App: every Supabase request aborts after 30 s (storage 120 s). Functions: outbound calls via fetchWithTimeout (Resend 15 s, Expo 8 s, HIBP 4 s). Database: Supabase statement timeouts per role.",
   "CODE", "lib/supabase/client.ts, _shared/http.ts"),
  ("Exponential backoff", "Wait longer after each failure (1 s, 2 s, 4 s …) plus random jitter.",
   "fetchWithRetry: full-jitter backoff, honours Retry-After, retries only 408/429/5xx/network. Invite retry queue: 5 min·2^n up to 6 h, ±20 % jitter, max 5 attempts. App import retries 2× with backoff. Login lockout grows 15 s → 15 min.",
   "CODE", "_shared/http.ts, admin-invite-students, lib/invites.ts, lib/auth/throttle.ts"),
  ("Idempotency", "Doing the same request twice has the same effect as once.",
   "Imports carry an Idempotency-Key (unique index per admin) → replay returns the first result. Resend batches get an Idempotency-Key so retries never double-send. Webhooks dedupe by event id; pushes once per notification; upserts keyed by e-mail.",
   "CODE", "student_imports.idempotency_key, webhook_events"),
  ("Circuit breakers", "Stop calling a failing service for a while instead of piling up timeouts.",
   "CircuitBreaker (closed → open after 3 failures → half-open after 60 s). While Resend is down, invites are queued for the retry worker instead of waiting on timeouts.",
   "CODE", "_shared/http.ts, admin-invite-students"),
  ("Error handling", "Fail predictably and tell the caller what happened.",
   "HttpError → JSON {error, request_id} with the right status; unknown errors become a generic 500 and are logged, never leaked. Half-created accounts are rolled back (compensating action). App maps every code to German/English text.",
   "CODE", "_shared/http.ts (errorResponse), admin-create-student, signup-with-code"),
  ("HTTP status codes", "The standard meaning of 2xx/4xx/5xx responses.",
   "201 created, 204 preflight, 400 validation, 401 unauthenticated, 403 forbidden, 404, 405 + Allow, 409 conflict, 413 too large, 429 + Retry-After, 500, 502 upstream, 503 not configured — documented per function.",
   "CODE", "docs/API.md"),
  ("Race conditions", "Two operations interleave and corrupt data.",
   "Rate limiter uses one atomic INSERT … ON CONFLICT DO UPDATE (tested: 50 parallel clients, 500 calls → exactly 500 counted). Unique indexes stop duplicate codes/imports; colliding import rows retry one by one; booking uses row locks.",
   "CODE", "check_rate_limit, scripts/db-load.sh"),
  ("Concurrency", "Doing many things at once safely.",
   "Server: Postgres MVCC + unique constraints, independent stateless function instances. Client: double-submit guards (busy refs), in-flight de-duplication of flag requests, Promise.all for parallel loads.",
   "CODE", "lib/flags.ts, app/admin/students/import.tsx"),
  ("Async/await", "Writing asynchronous code that reads top-down.",
   "All I/O is async/await; every promise is awaited or explicitly caught; effects cancel late results with an 'alive' flag so unmounted screens are never updated.",
   "CODE", "lib/*, app/*"),
  ("Feature flags", "Turn features on/off without a release.",
   "app_settings 'feature.*' + feature_flags() RPC; admins flip switches (invite e-mails, list import, performance view) in Administration; functions enforce them server-side (kill switch for mail during an incident).",
   "CODE", "lib/flags.ts, app/admin/settings.tsx"),
  ("Disaster recovery", "Getting back up after losing data or a region.",
   "Daily Supabase backups (PITR optional), schema rebuildable from migrations (proven by CI), off-site dump + storage copy procedure, RPO ≤ 24 h / RTO ≤ 4 h, twice-yearly restore drill.",
   "PROCESS", "docs/OPERATIONS.md (Backups & DR)"),
  ("Backups", "Copies of data to restore from.",
   "Automatic daily database backups by Supabase; weekly `supabase db dump` and monthly storage copy recommended into encrypted storage.",
   "PLATFORM", "docs/OPERATIONS.md"),
 ]),
 ("3 · Data & database", [
  ("DB migrations", "Versioned, ordered schema changes.",
   "20 SQL migrations, idempotent (if not exists / create or replace), applied in order; CI applies all to an empty Postgres and re-applies the newest to prove they're re-runnable.",
   "CODE", "supabase/migrations, scripts/db-test.sh"),
  ("Database indexing", "Indexes make lookups fast.",
   "Audit found 11 foreign keys without an index (e.g. appointments.slot_id on the booking path) → all added; partial indexes for the retry queue, provider message ids, idempotency keys; audit-log indexes by time/record/actor.",
   "CODE", "migrations/20261111000001 §1"),
  ("DB normalization", "Each fact stored once, related by keys.",
   "Students, packages, topics, classes, enrolments, appointments are separate tables linked by foreign keys (3NF). Deliberate denormalisation: import rows as jsonb snapshot (history), aggregates computed by RPCs instead of stored.",
   "CODE", "supabase/migrations/20260804000001_schema.sql"),
  ("Soft deletes", "Mark rows as deleted instead of removing them.",
   "Students are deactivated (is_active = false) and invites revoked (status) — both reversible. Account deletion is a hard delete on purpose: GDPR/App Store require real erasure.",
   "CODE", "profiles.is_active, student_invites.status"),
  ("Data validation on server", "Never trust the client.",
   "Check constraints (code format, e-mail format, lengths, flag values), guard triggers, and validation in every function (e-mail, UUIDs, sizes, formats, row counts). App checks are only for UX.",
   "CODE", "migrations, functions"),
  ("Row level security", "The database decides row by row who may read/write.",
   "RLS on all 22 tables; students see only their own rows, admins via is_admin(); service-only tables have RLS without policies. 39 live probes + SQL tests as anon/student/admin/service role.",
   "CODE", "supabase/tests/10_security.sql"),
  ("Time zones", "Store instants in UTC, show local time.",
   "Times are timestamptz; school logic (streaks, league week, quiz limit) uses Europe/Berlin; fixed three places that used UTC 'today' (file names, CSV name, reminder ids).",
   "CODE", "lib/performance.ts (berlinDay), lib/motivation.ts"),
  ("Character encoding", "Bytes ↔ text without mojibake.",
   "UTF-8 everywhere; imports detect UTF-8 / UTF-16 / Windows-1252 (German Excel CSV) — verified with umlauts; CSV export has a BOM for Excel; JSON bodies decoded with fatal UTF-8.",
   "CODE", "lib/student-import.ts, _shared/http.ts"),
  ("Cache invalidation", "Making sure caches don't serve stale data.",
   "Web: hashed file names (immutable) + revalidated index.html. Feature flags cached 60 s and invalidated on change. Profile cache cleared on sign-out; screens reload on focus.",
   "CODE", "vercel.json, lib/flags.ts, lib/user-context.tsx"),
 ]),
 ("4 · Identity & access", [
  ("Authentication", "Proving who someone is.",
   "Supabase Auth (email + password). Functions verify the JWT with auth.getUser() (signature, expiry, revoked sessions). Biometric app lock on the device as a second layer.",
   "CODE", "_shared/serve.ts (authenticate), lib/biometric.ts"),
  ("Authorization", "Deciding what someone may do.",
   "Database: RLS + guard triggers. Functions: requireAdmin() before any service-role action. UI hides admin areas, but security never depends on the UI.",
   "CODE", "_shared/serve.ts (requireAdmin)"),
  ("RBAC", "Permissions attached to roles.",
   "Roles student/admin in profiles.role; is_admin() used by RLS, RPCs and functions; the last active admin can't be demoted; students can't change their own role.",
   "CODE", "lib/rbac/permissions.ts, guard_profile_privileges"),
  ("Principle of least privilege", "Give each part only what it needs.",
   "App holds only the publishable key; service role only inside functions after authorisation; SECURITY DEFINER functions have fixed search_path and EXECUTE revoked from public; rate limiter callable only by service_role; audit log append-only even for service_role; nginx runs unprivileged.",
   "CODE", "migrations, Dockerfile"),
  ("Session management", "How long-lived sign-ins are created, kept and ended.",
   "Short-lived access tokens + refresh tokens (auto refresh); sign-out revokes server-side (fallback local); the device's push token is now removed on sign-out; recovery sessions end if the user leaves without setting a password.",
   "CODE", "lib/user-context.tsx, app/reset-password.tsx"),
  ("Token expiration and refresh", "Access tokens expire quickly and are renewed.",
   "Supabase JWT access tokens expire (1 h default) and supabase-js refreshes them in the background (autoRefreshToken); revoked refresh tokens stop the session.",
   "PLATFORM", "lib/supabase/client.ts"),
  ("Password reset flows", "Safe 'forgot password'.",
   "Recovery mail → allow-listed redirect → reset screen. Hardened: a password can only be set right after a recovery link (not on any unlocked signed-in device); new password must pass policy + HIBP; leaving without saving signs out.",
   "CODE", "app/reset-password.tsx, lib/auth/recovery.ts"),
  ("Brute force protection", "Slowing down password/code guessing.",
   "Sign-up codes: 10 tries / 10 min per IP + 5 / h per e-mail (shared limiter) and identical answers for all wrong codes; login: Supabase Auth rate limits + app backoff after 3 wrong passwords.",
   "CODE", "signup-with-code, lib/auth/throttle.ts"),
  ("Account lockout", "Temporarily blocking after repeated failures.",
   "Soft lockout per e-mail in the app (15 s doubling to 15 min). A hard server-side lockout would let attackers lock real students out on purpose; Supabase's IP-based limits are used instead.",
   "CODE", "lib/auth/throttle.ts"),
  ("Magic links", "Sign in by clicking a link in an e-mail.",
   "Not offered: students sign in many times a day on their phone; mail round-trips hurt that. Supabase supports it (signInWithOtp) if wanted later; the recovery mail already uses the same signed-link mechanism.",
   "PLANNED", "lib/supabase/client.ts"),
  ("Pass keys", "Phishing-resistant sign-in with device keys (WebAuthn).",
   "Planned with the next native build (needs associated domains). Today the biometric app lock gives a Face ID / fingerprint gate on the device.",
   "PLANNED", "lib/biometric.ts"),
  ("SSO", "One login across services (Google, Microsoft, SAML).",
   "Not needed: students are private individuals invited by the school. Supabase Auth supports OAuth/SAML if the school adopts a workspace.",
   "PLANNED", "—"),
  ("API keys", "Secrets that identify a calling application.",
   "Only the publishable key ships in the app (safe by design — RLS protects data). Server keys (service role, Resend) exist only as function secrets; CI blocks builds that contain them.",
   "CODE", "scripts/check-bundle.mjs"),
  ("IDOR", "Insecure direct object reference: reading someone else's record by changing an id.",
   "RLS on every table; delete-account takes the user from the JWT, never the body; tests try to read/update another student's profile and topic stats (blocked).",
   "CODE", "supabase/tests/10_security.sql"),
  ("Mass assignment", "Sending extra fields to change things you shouldn't.",
   "Found and fixed: students could change their own e-mail (used to match accounts!), streak, licence class, topic, created date. Guard trigger now keeps these; functions copy only whitelisted fields.",
   "CODE", "guard_profile_privileges (migration 20261111000001 §2)"),
 ]),
 ("5 · Web & input security", [
  ("Input validations", "Check every input for type, length and format.",
   "Server: e-mail regex + length, UUIDs, code patterns, file formats, path regex, row/body limits, JSON object shape, fatal UTF-8. Client mirrors the rules for instant feedback.",
   "CODE", "_shared/http.ts (readJson), _shared/invites.ts"),
  ("SQL injection", "Smuggling SQL through input.",
   "No string-built SQL: PostgREST and supabase-js parameterise; PL/pgSQL uses parameters; dynamic SQL only with format('%I'). Probe: \"x' or '1'='1\" filter returns nothing; malformed order clause rejected (400).",
   "CODE", "scripts/security-probe.mjs"),
  ("XSS", "Injecting script into pages.",
   "React escapes all output; no innerHTML/dangerouslySetInnerHTML/eval anywhere; invite e-mails HTML-escape names (tested with <img onerror>); CSP script-src 'self' blocks injected scripts.",
   "CODE", "_shared/invites.ts (escapeHtml), vercel.json"),
  ("Content security policies", "Browser allow-list of where scripts, styles and connections may come from.",
   "Strict CSP on the web app: default-src 'self', script-src 'self', object-src 'none', frame-ancestors 'none', base-uri/form-action 'self', connect-src only Supabase/Expo/HIBP. Functions answer with default-src 'none'.",
   "CODE", "vercel.json, _shared/http.ts"),
  ("Security headers", "HTTP headers that switch on browser protections.",
   "HSTS (2 y, preload), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, CORP, X-Permitted-Cross-Domain-Policies; the uptime job fails if any disappears.",
   "CODE", "vercel.json, .github/workflows/uptime.yml"),
  ("Clickjacking", "Hiding the app in an invisible frame to trick clicks.",
   "frame-ancestors 'none' + X-Frame-Options DENY on web and functions (verified live).",
   "CODE", "vercel.json"),
  ("Cookie flags (HttpOnly, Secure, SameSite)", "Cookie attributes that stop theft and CSRF.",
   "The app sets no auth cookies — tokens are sent as Authorization headers, which also rules out CSRF. Any cookie we add must be HttpOnly; Secure; SameSite=Lax. Token theft via XSS is mitigated by the strict CSP.",
   "CODE", "lib/supabase/client.ts"),
  ("SSRF", "Tricking the server into calling internal URLs.",
   "Functions only call fixed hosts (api.resend.com, exp.host, api.pwnedpasswords.com); no URL ever comes from input.",
   "CODE", "supabase/functions/*"),
  ("Open redirects", "Using our domain to forward victims to an attacker.",
   "No redirect/next/returnTo parameters are read; post-login routes are in-memory constants; recovery redirects are allow-listed in Supabase. Probe confirms parameters are ignored.",
   "CODE", "lib/auth/flow.ts, scripts/security-probe.mjs"),
  ("Path traversal", "Using ../ to reach files outside the intended folder.",
   "Stored file names are generated; the extension now comes from the validated MIME type (fixed); import paths must match ^imports/… without '..'; storage policies scope folders by user id.",
   "CODE", "lib/documents.ts (safeDocumentExt), admin-invite-students"),
  ("Command injection", "Getting the server to run shell commands.",
   "No shell, eval or child processes anywhere in the runtime code (functions run in Deno isolates without subprocess permission).",
   "CODE", "—"),
  ("File upload security", "Accepting files without accepting attacks.",
   "Private buckets, size caps (10/25 MB) and MIME allow-lists enforced by Storage, admin-only writes, generated names, zip-bomb cap (60 MB unpacked) for xlsx/ods, old .xls refused, CSV formula injection neutralised.",
   "CODE", "lib/student-import.ts, migrations (buckets)"),
  ("Rate limiting", "Capping how often a client may call.",
   "Shared Postgres limiter (fixed window, atomic) on sign-up, imports, sends, creates, deletes, intake; 429 + Retry-After; Supabase Auth limits logins; per-invite 60 s resend cooldown.",
   "CODE", "check_rate_limit, _shared/serve.ts"),
  ("Environment limiting", "Keeping dev, preview and production apart.",
   "EAS build profiles and environments (development/preview/production) with their own variables; Vercel preview deployments per pull request; CI uses placeholder keys; destructive test scripts refuse to run without explicit env vars.",
   "CODE", "eas.json, .github/workflows/ci.yml"),
  ("HTTPS / TLS", "Encrypted transport.",
   "All endpoints HTTPS only; HTTP is redirected (308, verified); HSTS preload; iOS App Transport Security and Android cleartext-off by default.",
   "PLATFORM", "vercel.json"),
  ("Penetration testing", "Attacking your own system to find holes.",
   "Black-box probe (39 checks, read-only, anon key only) against production: all passed. White-box SQL tests as each role. Internal audit found and fixed mass assignment, reset-password re-auth gap, leaked error messages, non-constant-time secret checks.",
   "CODE", "scripts/security-probe.mjs, supabase/tests/"),
 ]),
 ("6 · Data protection & privacy", [
  ("Secrets management", "Keeping keys out of code and logs.",
   "Function secrets / Vault / EAS env / GitHub secrets only; .env and *.local.sql git-ignored; logger redacts passwords, tokens, keys and masks e-mails; CI scans the web bundle for server keys.",
   "CODE", "_shared/http.ts (redact), scripts/check-bundle.mjs"),
  ("Secret rotation", "Replacing keys regularly or after a leak.",
   "Runbook for Resend, webhook/cron/intake secrets, JWT keys and the school sign-up code; webhook verifier accepts several signatures during a switch. The original default sign-up code is in public git history and must be changed in production.",
   "PROCESS", "docs/OPERATIONS.md (Secrets)"),
  ("Hashing vs encryption", "Hashing is one-way (passwords); encryption is reversible with a key (data).",
   "Passwords are hashed (bcrypt via Supabase Auth) and never stored or logged by us; HIBP sends only 5 chars of a SHA-1 hash; webhooks are checked with HMAC-SHA256; data at rest/in transit is encrypted, not hashed.",
   "PLATFORM", "signup-with-code"),
  ("Salting", "A random value per password so equal passwords hash differently.",
   "bcrypt stores a unique salt inside every hash (Supabase Auth); we never handle raw hashes.",
   "PLATFORM", "—"),
  ("Encryption at rest", "Stored data is encrypted on disk.",
   "Supabase encrypts database disks, backups and storage (AES-256); secrets in Vault are additionally encrypted. Planned: move the phone session from AsyncStorage to the Keychain/Keystore (expo-secure-store) with the next native build.",
   "PLATFORM", "docs/OPERATIONS.md"),
  ("Encryption in transit", "Data encrypted on the wire.",
   "TLS for every app ↔ server and server ↔ provider call (Resend, Expo, HIBP); HSTS prevents downgrade.",
   "PLATFORM", "—"),
  ("GDPR / data privacy", "Lawful, minimal, deletable personal data.",
   "Self-service account deletion now also deletes stored documents; admin delete likewise; import row details minimised after 180 days; audit log stores only needed columns and never the sign-up code; logs mask e-mails; EU-hosted; deletion page live for the stores.",
   "CODE", "delete-account, purgeStudentFiles, cron jobs"),
  ("Audit logs", "Who did what, when — tamper-resistant.",
   "public.audit_log via triggers on profiles (role, active, code, e-mail, class), invites, imports, settings/flags; append-only for every API role (tested); admins can read; 2-year retention.",
   "CODE", "migrations/20261111000001 §4"),
 ]),
 ("7 · Observability & operations", [
  ("Logging", "Recording what happened.",
   "Every function logs an access line (method, status, duration) and events; errors with context.",
   "CODE", "_shared/serve.ts"),
  ("Structured logging", "Logs as machine-readable JSON instead of free text.",
   "One JSON object per line: ts, level, fn, request_id, msg + fields — searchable in the Supabase Logs Explorer; secrets redacted automatically.",
   "CODE", "_shared/http.ts (createLogger)"),
  ("Distributed tracing", "Following one request across services.",
   "The app tags every function call with x-request-id; functions reuse it in all log lines, return it in responses and errors, and pass it on (Resend idempotency keys). Full OpenTelemetry is unnecessary at this size.",
   "CODE", "lib/supabase/client.ts, _shared/http.ts"),
  ("Monitoring", "Watching health and performance.",
   "Supabase reports (CPU, connections, slow queries), Vercel analytics, function logs; uptime workflow checks availability, latency (< 5 s) and headers every 15 min.",
   "CODE", ".github/workflows/uptime.yml"),
  ("Uptime monitoring", "Regular external checks that the service is up.",
   "Scheduled GitHub Action every 15 minutes against the web app and Supabase Auth health.",
   "CODE", ".github/workflows/uptime.yml"),
  ("Alerting", "Telling a human when something breaks.",
   "Failed uptime/CI runs e-mail the owner; Dependabot opens security PRs; usage alerts in Supabase/Vercel/Resend (runbook).",
   "PROCESS", "docs/OPERATIONS.md (Monitoring)"),
  ("Cost monitoring", "Tracking spend before it surprises you.",
   "Spend caps on, monthly checklist (database size, egress, invocations, bandwidth, e-mails, EAS builds at 80 % of the free plan).",
   "PROCESS", "docs/OPERATIONS.md (Cost)"),
  ("Debugging", "Finding the cause of a bug.",
   "request_id from the app's error → function log lines; stable error codes; local Postgres harness reproduces database behaviour; simulator + web preview for UI.",
   "PROCESS", "docs/OPERATIONS.md (Incident checklist)"),
  ("Profiling", "Measuring where time goes.",
   "auto_explain on the admin performance RPC: 80 ms for 2,000 students / 100k rounds, the quiz_attempts index scan is the main cost (29 ms); web bundle measured per build.",
   "CODE", "scripts/db-load.sh"),
  ("Memory leaks", "Memory that is never released.",
   "Audit of every effect: all subscriptions (auth, realtime channels, AppState, notifications, timers) are cleaned up. Bounded in-memory maps (throttles) in functions and app.",
   "CODE", "components/*, lib/auth/throttle.ts"),
  ("Performance budgets", "Hard limits on bundle size/speed.",
   "CI fails if web JS exceeds 4.4 MB raw / 1.15 MB gzip or the export exceeds 16 MB (today 3.75 MB / 0.95 MB / 11 MB).",
   "CODE", "scripts/check-bundle.mjs"),
  ("Mobile responsiveness", "Layouts that work on every screen.",
   "Admin kit switches table ↔ cards at 900 px, grids reflow; student app column capped at 672 pt; checked on iPhone simulator, phone width and desktop.",
   "CODE", "components/admin/kit.tsx"),
 ]),
 ("8 · Process, testing & delivery", [
  ("Automated testing", "Tests that run without a human.",
   "93 unit tests (Vitest), SQL security suite, Playwright end-to-end specs, load + race scripts; CI runs them on every push.",
   "CODE", "tests/, supabase/tests/, e2e/"),
  ("Unit vs integration vs end-to-end tests", "Small pieces / pieces together / the whole app like a user.",
   "Unit: parsing, planning, retries, breaker, webhooks, throttle. Integration: all migrations + RLS on real Postgres as each role. E2E: Playwright against the web build (login, workflows, layout).",
   "CODE", "tests/, supabase/tests/, e2e/"),
  ("Load testing", "Measuring behaviour under heavy traffic.",
   "Web: 400 requests / 20 parallel → 124 req/s, p50 110 ms, p95 586 ms, 0 errors. Database: 10 parallel admin dashboards on 2,000 students → 52 tps, 192 ms avg.",
   "CODE", "scripts/load-test.mjs, scripts/db-load.sh"),
  ("Code review", "A second person checks every change.",
   "Pull requests with a review checklist (RLS, server validation, secrets, idempotent migrations, i18n, phone + desktop), CODEOWNERS for database and server code, CI must be green.",
   "PROCESS", ".github/pull_request_template.md, .github/CODEOWNERS"),
  ("Semantic versioning", "MAJOR.MINOR.PATCH communicates the kind of change.",
   "Codebase 1.1.0 (new features, compatible); store version follows native builds; CHANGELOG.md per release.",
   "PROCESS", "CHANGELOG.md, docs/OPERATIONS.md"),
  ("API versioning", "Changing an API without breaking old clients.",
   "X-API-Version header on every response, unknown majors refused; additive changes only within v1; old store builds keep working because responses only gain fields.",
   "CODE", "_shared/http.ts (checkApiVersion)"),
  ("API documentation", "How to call the API.",
   "Every function documented: auth, request, responses, error codes, limits, idempotency; header comment in each function repeats its contract.",
   "PROCESS", "docs/API.md"),
  ("Dependency vulnerabilities", "Known holes in libraries.",
   "npm audit fix removed the critical and most high issues; CI gate fails on new high/critical advisories; 3 remaining ones need an Expo SDK upgrade and are accepted with reasons and an expiry date; Dependabot weekly.",
   "CODE", "scripts/audit.mjs, security/audit-allowlist.json"),
  ("Technical debt", "Shortcuts that cost later.",
   "Tracked openly: AsyncStorage → SecureStore, custom-scheme recovery links → universal links + PKCE, Expo SDK upgrade (closes accepted advisories), edge functions still use // @ts-nocheck for the Deno globals (shared modules are strictly checked).",
   "PROCESS", "this report § Next steps"),
 ]),
]

STATUS_STYLE = {
  'CODE': ('#0f7a2a', '#e6f6ea', 'In code'),
  'PLATFORM': ('#1d4ed8', '#e8efff', 'Platform'),
  'PROCESS': ('#a15c00', '#fff3e0', 'Process'),
  'PLANNED': ('#555', '#eee', 'Planned'),
}

VERIFY = [
  ("Unit tests (Vitest)", "93 / 93 passed"),
  ("TypeScript (app)", "tsc --noEmit: 0 errors"),
  ("Edge functions", "deno lint + deno check: 8 / 8 clean"),
  ("Database", "20 migrations applied to empty Postgres 17, re-applied idempotently; SQL security suite passed as anon, student, admin, service role"),
  ("Concurrency", "rate limiter: 50 parallel clients × 10 calls → 500 counted, no lost updates"),
  ("Load (database)", "2,000 students / 100k rounds: 10 parallel admins → 52 tps, 192 ms avg, 0 failures"),
  ("Load (web, production)", "400 requests @ 20 parallel → 124 req/s, p50 110 ms, p95 586 ms, 0 errors"),
  ("Penetration probe (production)", "39 / 39 checks passed"),
  ("Dependencies", "0 critical; remaining high advisories reviewed + accepted until 2027-03-31"),
  ("Bundle budget", "JS 3.75 MB raw / 0.95 MB gzip (budget 4.4 / 1.15); no secrets in bundle"),
]

NEXT = [
  "Apply migration 20261111000001_platform_hardening.sql, then deploy all 8 edge functions (including the new resend-webhook).",
  "Set secrets: RESEND_WEBHOOK_SECRET (Resend → Webhooks), CRON_SECRET (+ run supabase/scripts/schedule_invite_retry.sql), optional ALLOWED_ORIGINS.",
  "Change the school sign-up code in Administration → Anmeldecode (the original default is in public git history).",
  "Move the WordPress intake form's secret from ?secret= to the x-intake-secret header, then rotate INTAKE_SECRET.",
  "Add the SUPABASE_ANON_KEY repository secret so the uptime job also checks the API.",
  "Next native build (1.0.2): expo-secure-store for sessions, universal links + PKCE for recovery, passkeys.",
  "Plan the Expo SDK upgrade to close the accepted advisories before 2027-03-31.",
]


def esc(s):
    return html.escape(s, quote=True)


def build_html():
    total = sum(len(items) for _, items in S)
    counts = {}
    for _, items in S:
        for it in items:
            counts[it[3]] = counts.get(it[3], 0) + 1
    rows = []
    toc = []
    for title, items in S:
        anchor = title.split('·')[0].strip()
        toc.append(f'<li><a href="#s{anchor}">{esc(title)}</a> <span class="muted">({len(items)})</span></li>')
        rows.append(f'<h2 id="s{anchor}">{esc(title)}</h2>')
        for concept, what, how, status, where in items:
            fg, bg, label = STATUS_STYLE[status]
            rows.append(
                f'<div class="card"><div class="head"><span class="name">{esc(concept)}</span>'
                f'<span class="tag" style="color:{fg};background:{bg}">{label}</span></div>'
                f'<div class="what">{esc(what)}</div>'
                f'<div class="how">{esc(how)}</div>'
                f'<div class="where">{esc(where)}</div></div>'
            )
    legend = ''.join(
        f'<span class="tag" style="color:{fg};background:{bg}">{lbl} · {counts.get(k, 0)}</span> '
        for k, (fg, bg, lbl) in STATUS_STYLE.items()
    )
    verify = ''.join(f'<tr><td>{esc(a)}</td><td>{esc(b)}</td></tr>' for a, b in VERIFY)
    nxt = ''.join(f'<li>{esc(n)}</li>' for n in NEXT)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Engineering practices — Fahrschule Abgefahrn</title>
<style>
  @page {{ size: A4; margin: 16mm 14mm 18mm; }}
  body {{ font: 10.2pt/1.45 -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #111; }}
  h1 {{ font-size: 22pt; margin: 0 0 4px; }}
  h2 {{ font-size: 13.5pt; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #00c21d; break-after: avoid; }}
  .sub {{ color: #444; margin-bottom: 14px; }}
  .muted {{ color: #777; }}
  .card {{ border: 1px solid #e3e3e3; border-radius: 8px; padding: 8px 10px; margin: 0 0 7px; break-inside: avoid; }}
  .head {{ display: flex; justify-content: space-between; align-items: center; gap: 8px; }}
  .name {{ font-weight: 700; font-size: 10.8pt; }}
  .tag {{ font-size: 8pt; font-weight: 700; padding: 2px 7px; border-radius: 99px; white-space: nowrap; }}
  .what {{ color: #555; font-style: italic; margin: 2px 0 3px; }}
  .where {{ color: #0f5f8a; font: 8.5pt ui-monospace, Menlo, monospace; margin-top: 3px; }}
  table {{ border-collapse: collapse; width: 100%; font-size: 9.5pt; }}
  td {{ border-bottom: 1px solid #eee; padding: 5px 6px; vertical-align: top; }}
  td:first-child {{ font-weight: 600; width: 32%; }}
  .box {{ background: #f6f8f6; border-radius: 8px; padding: 10px 14px; }}
  ol, ul {{ margin: 4px 0 0 18px; padding: 0; }}
  .cover {{ break-after: page; }}
</style></head><body>
<div class="cover">
  <h1>Engineering practices report</h1>
  <div class="sub">Fahrschule Abgefahrn — student app (iOS, Android, web) and admin dashboard · version 1.1.0 · {date.today().isoformat()}</div>
  <p>This report goes through {total} engineering concepts. Each one says, in one line, what the concept means and
  then exactly how it is applied in this project, with the files to look at. Tags show where the protection lives:
  <b>In code</b> = implemented in this repository, <b>Platform</b> = provided by Supabase / Vercel / Expo,
  <b>Process</b> = a documented practice, <b>Planned</b> = not done yet, with the reason.</p>
  <p>{legend}</p>
  <h2>How it fits together</h2>
  <div class="box">Phones (Expo app) and browsers (static web app on Vercel's CDN) talk over HTTPS to Supabase:
  an API gateway in front of PostgREST, Auth, Storage, Realtime and eight Deno edge functions. Postgres enforces
  access with Row Level Security; pg_cron runs maintenance; Resend sends e-mail, Expo sends pushes.
  Everything stateful is in Postgres, so every other part can scale out or be replaced.</div>
  <h2>Verification run ({date.today().isoformat()})</h2>
  <table>{verify}</table>
  <h2>Contents</h2><ol>{''.join(toc)}</ol>
</div>
{''.join(rows)}
<h2>Next steps (need you / the next native build)</h2>
<ol>{nxt}</ol>
<p class="muted" style="margin-top:14px">Generated by scripts/build-practices-report.py. Runbooks: docs/OPERATIONS.md · API: docs/API.md · Security policy: SECURITY.md · Changes: CHANGELOG.md.</p>
</body></html>"""


def main():
    with open(OUT_HTML, 'w', encoding='utf-8') as f:
        f.write(build_html())
    chrome = next((p for p in [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        shutil.which('google-chrome') or '', shutil.which('chromium') or '',
    ] if p and os.path.exists(p)), None)
    if not chrome:
        print('HTML written; install Chrome to render the PDF:', OUT_HTML)
        return
    subprocess.run([chrome, '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
                    f'--print-to-pdf={OUT_PDF}', 'file://' + OUT_HTML], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print('PDF:', OUT_PDF, os.path.getsize(OUT_PDF), 'bytes')


if __name__ == '__main__':
    sys.exit(main())
