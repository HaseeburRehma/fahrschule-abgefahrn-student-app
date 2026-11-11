# API reference (edge functions)

Base URL: `https://<project-ref>.supabase.co/functions/v1/<name>` · JSON over HTTPS only.

## Conventions (all functions)

| Topic | Rule |
|---|---|
| Versioning | Every response carries `X-API-Version: 1`. Clients may send `X-API-Version: 1`; an unknown major version gets `400 unsupported_api_version` instead of a half-working answer. Breaking changes ship as a new major with the old one kept until all store builds have moved on (mobile apps can't be force-updated). |
| Tracing | Send `x-request-id` (8–80 chars `[A-Za-z0-9._-]`); it's reused in every log line and echoed back. Otherwise the server creates one. The app sets it automatically. |
| Errors | `{ "error": "<stable_code>", "request_id": "…", …details }`. Codes are stable; messages for people live in the app (German/English). Internal error text never leaves the server. |
| Status codes | `200` ok · `201` created · `204` CORS preflight · `400` invalid input · `401` not signed in / bad secret or signature · `403` signed in but not allowed (or `invalid_code`, `feature_disabled`) · `404` not found · `405` wrong method (`Allow` header) · `409` conflict (`email_exists`, `import_in_progress`) · `413` body too large · `429` rate limited (`Retry-After` header) · `500` server error · `502` upstream provider failed · `503` not configured. |
| Rate limits | Fixed window, shared across instances (`public.check_rate_limit`). On `429` wait `Retry-After` seconds. |
| Idempotency | `Idempotency-Key: <uuid v4>` on import requests: the same key returns the first result (`"replayed": true`), never a second import. |
| CORS | `ALLOWED_ORIGINS` secret (comma list) restricts browser origins; unset = `*` (the native apps send no Origin). |
| Body size | Hard limits per function (below); larger bodies get `413`. |

## Functions

### `signup-with-code` — public student sign-up
`POST { first_name, last_name?, email, password, school_code, locale? }` → `201 { id }`

Errors: `invalid_input`, `weak_password` (≥ 8, letter + digit), `pwned_password` (HaveIBeenPwned), `invalid_code` (403, same answer for every wrong code), `email_exists` (409), `rate_limited` (429: 10 / 10 min per IP, 5 / h per e-mail). Body ≤ 10 KB.

### `admin-invite-students` — import + invites (admin)
Auth: `Authorization: Bearer <admin access token>` (verified with Supabase Auth + `is_admin()`).

* `POST { action: "import", file_name, file_format: xlsx|ods|csv|tsv|txt|paste, file_path?, rows: [{ row, email, first_name?, last_name?, phone?, student_code? }], send: boolean }` + `Idempotency-Key`
  → `{ import_id, summary, rows: [{ outcome, reason, student_code, mail }], mail_configured, replayed? }`. ≤ 2,000 rows, ≤ 3 MB, 30 imports / h per admin.
* `POST { action: "send", invite_ids: [uuid…] }` → `{ results: { id: sent|failed|skipped|throttled|not_configured|disabled|queued }, tally }`. ≤ 500 ids, 120 / h per admin, 60 s resend cooldown per invite.
* `POST { action: "retry" }` + `x-cron-secret` — background worker (pg_cron), re-sends due failed invites.

Errors: `forbidden`, `feature_disabled`, `invalid_file_path`, `too_many_rows`, `import_in_progress`, `rate_limited`.

### `resend-webhook` — e-mail delivery events (Resend → us)
Svix-signed (`svix-id`, `svix-timestamp`, `svix-signature`), 5-minute replay window, each event processed once. Updates `student_invites.delivery_status` (`delivered`, `bounced`, `complained`, `delayed`). Unknown events → `200 { ignored }`.

### `admin-create-student` (admin)
`POST { email, first_name?, last_name?, phone?, current_theory_topic_id?, package_ids?: uuid[] ≤ 20 }` → `{ id }`. `409 email_exists`. Half-created accounts are rolled back.

### `admin-delete-student` (admin)
`POST { id: uuid }` → `{ ok, id }`. Deletes stored files first (GDPR), refuses admins and self.

### `delete-account` (signed-in user)
`POST` (no body) → `{ ok }`. Deletes the caller's own account and files. Admins can't self-delete. 5 / h.

### `intake-signup` (website form → account)
Secret in `x-intake-secret` (query `?secret=` still accepted, deprecated). JSON or form-encoded ≤ 64 KB, 30 / h per IP. Creates or links the student and assigns the booked package.

### `push-dispatch` (database → Expo push)
Internal webhook: `x-webhook-secret`. Re-reads the notification row, pushes each notification at most once.

## Database RPCs used by the app

| RPC | Who | Purpose |
|---|---|---|
| `is_admin()` | signed in | RBAC check |
| `admin_student_performance()` | admin | per-student aggregates |
| `admin_student_topic_stats(p_student)` | admin | per-topic score |
| `feature_flags()` | everyone | `{ key, enabled }` kill switches |
| `touch_streak()` | student | the only writer of streak fields |
| `check_rate_limit(key, limit, window)` | service role | shared rate limiter |
