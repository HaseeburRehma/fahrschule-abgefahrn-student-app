# Operations runbook

## Architecture

```
iOS / Android app (Expo, OTA updates via EAS)      Web app (static export on Vercel's CDN)
                 \                                   /
                  └──── HTTPS / TLS 1.2+ ───────────┘
                                 │
                 Supabase (managed, EU): API gateway (Kong) → PostgREST · Auth (GoTrue) · Storage · Realtime
                                 │                      Edge Functions (Deno isolates)
                         Postgres 15+ (RLS, pg_cron, pg_net, Vault)   →  Resend (e-mail) · Expo Push · HIBP
```

Everything except the app code is managed: load balancing, TLS termination, the reverse proxy and API
gateway (Kong in front of PostgREST/Auth/Storage/Functions), connection pooling (Supavisor) and the CDN
(Vercel edge network) are provided by Supabase and Vercel. There are no servers of our own to patch.

## Deploy order

1. **Database**: `supabase db push` (or paste the new file from `supabase/migrations/` into the SQL editor). Migrations are idempotent and run in file-name order. CI applies all of them to a fresh Postgres and runs the security tests first.
2. **Edge functions**: `supabase functions deploy <name>` (gateway JWT settings come from `supabase/config.toml`).
3. **Secrets** (Dashboard → Edge Functions → Secrets): `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`, `APP_WEB_URL`, `RESEND_WEBHOOK_SECRET`, `CRON_SECRET`, `WEBHOOK_SECRET`, `INTAKE_SECRET`, optional `ALLOWED_ORIGINS`.
4. **Web**: merge to `main` → Vercel builds and serves it from the CDN (instant rollback in Vercel → Deployments).
5. **Phones**: JS-only changes → `npx eas-cli update --channel production` (OTA). Native changes → new store build.

Rollback: Vercel "Promote" an older deployment; `eas update:republish` an older update; database changes go forward only (write a new migration that reverts).

## Versioning

* `package.json` `version` = codebase release, semantic versioning (`MAJOR.MINOR.PATCH`): breaking API/data change → major, new feature → minor, fix → patch. Every release gets a `CHANGELOG.md` entry.
* `app.json` `expo.version` = the store version. `runtimeVersion` follows it (`appVersion` policy), so it changes **only** with a new native build; OTA updates target the installed version. Bump it after a store version was approved.
* API: `X-API-Version` header (see docs/API.md).

## Secrets management & rotation

* Secrets live only in Supabase function secrets, Supabase Vault (for SQL/cron), EAS environment variables and GitHub Actions secrets — never in git (`.env`, `*.local.sql` are git-ignored; CI scans the web bundle for leaked keys).
* The app only contains the **publishable** (anon) key; everything sensitive happens server-side.
* Rotation (do yearly, and immediately when someone leaves or a leak is suspected):
  * Resend: create a new key → update `RESEND_API_KEY` → delete the old key.
  * Webhook secrets (`WEBHOOK_SECRET`, `INTAKE_SECRET`, `CRON_SECRET`): set the new value in function secrets **and** at the caller (Vault / WordPress form) → redeploy not needed.
  * Resend webhook signing secret: roll in Resend; the verifier accepts several `v1,` signatures during the switch.
  * Supabase JWT signing keys: Dashboard → Settings → JWT Keys (rotate; sessions refresh automatically).
  * **School sign-up code**: Administration → Anmeldecode. The original default is in the public git history, so it must be changed in production.

## Backups & disaster recovery

* Supabase takes daily backups (7 days on Pro, 14 on Team); Point-in-Time Recovery is an add-on (RPO minutes). Restore: Dashboard → Database → Backups.
* Schema is fully reproducible from `supabase/migrations/` (CI proves it on every push).
* Extra off-site copy (recommended weekly): `supabase db dump --data-only -f backup.sql` into encrypted storage.
* Storage files (documents bucket) are **not** in database backups — copy with `supabase storage cp -r ss:///documents ./documents-backup` monthly.
* Targets: RPO ≤ 24 h (daily backup), RTO ≤ 4 h (restore + redeploy functions + point web/app at the new project via EAS env vars and a new OTA update).
* DR drill (twice a year): restore the latest backup into a new project, run `npm run test:db` checks and `npm run security:probe` against it.

## Monitoring, logging & alerting

* **Uptime**: `.github/workflows/uptime.yml` checks the web app (status, < 5 s, security headers) and Supabase Auth health every 15 minutes; a failure e-mails the repo owner.
* **Logs**: edge functions write one JSON line per event (`ts, level, fn, request_id, msg, …`) with passwords/tokens redacted and e-mails masked. Search them in Dashboard → Edge Functions → Logs (or Logs Explorer) by `request_id` to follow a request end to end (the app sends the id).
* **Database**: Dashboard → Reports (CPU, connections, slow queries); `pg_stat_statements` for profiling.
* **Audit trail**: `public.audit_log` (who changed roles, codes, invites, settings, flags) — admins can query it.
* **Alerts to set up once**: Supabase → Settings → Billing usage alerts; Vercel → Usage notifications; Resend → bounce rate alerts.

## Cost monitoring

Free/Pro tiers today. Watch monthly: Supabase (database size, egress, function invocations), Vercel (bandwidth), Resend (e-mails/month), EAS (builds: free plan at 80 % — one build per platform, JS fixes via OTA). Spend caps on Supabase stay **on**.

## Scaling

* Stateless services: every edge function instance is disposable (state lives in Postgres), so Supabase scales them horizontally on demand; the web app is static files on a CDN.
* Database: vertical scaling (bigger compute add-on) first; read replicas (Supabase Pro+) when dashboards/reports start to compete with app traffic; connection pooling via Supavisor already on.
* Measured (local Postgres 17, 2,000 students / 100,000 quiz rounds): admin performance RPC 80 ms single, 192 ms average with 10 admins in parallel (52 tps); rate limiter 2,860 calls/s without lost updates under 50 parallel clients. Production web: 400 requests at concurrency 20 → p50 110 ms, p95 586 ms, 0 errors.

## Scheduled jobs (pg_cron)

| Job | When | What |
|---|---|---|
| purge-rate-limits | hourly | delete limiter windows older than a day |
| purge-webhook-events | daily | dedupe records older than 30 days |
| minimise-old-imports | daily | drop per-row import details after 180 days (GDPR) |
| audit-log-retention | weekly | delete audit entries older than 2 years |
| invite-retry (optional) | every 10 min | `supabase/scripts/schedule_invite_retry.sql` |

## Incident checklist

1. Check `uptime` workflow + Supabase status page + Vercel status.
2. Find failing requests by `request_id` in function logs.
3. Feature misbehaving? Switch it off: Administration → Anmeldecode & Schalter (feature flags) — no release needed.
4. Suspected leak: rotate the affected secret (above), check `audit_log`, revoke sessions (Dashboard → Auth → Users → sign out).
5. Write a short post-mortem in the repo (what, impact, fix, prevention).
