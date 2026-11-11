# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning: [Semantic Versioning](https://semver.org/) (see docs/OPERATIONS.md → Versioning).
Store versions (`expo.version`) are listed in brackets.

## [1.1.0] — 2026-11-11 (store: 1.0.1 + OTA)

### Added
- Student list import (xlsx, ods, csv, tsv, txt, paste) with preview, column mapping and import history.
- Personal student codes (kept from the file or generated), e-mail invites via Resend, invites screen.
- Admin performance dashboard with filters, CSV export and per-topic scores.
- Feature flags (kill switches) for invite e-mails, list import and the performance view.
- Delivery tracking for invite e-mails (Resend webhook: delivered / bounced / complained).
- Background retry queue for failed invite e-mails with exponential backoff.
- Append-only audit log of role, code, invite and settings changes.
- Shared rate limiting, idempotent imports (`Idempotency-Key`), structured JSON logs with request ids.
- CI (typecheck, unit, Deno, database security tests, Docker, bundle budget, dependency gate), uptime monitor, Dependabot, Dockerfile.

### Changed
- All edge functions use one hardened wrapper: consistent error codes and status codes, no internal error text to clients, timeouts, retries with backoff, circuit breaker, CORS allow-list, API version header.
- Supabase client requests time out (30 s API / 120 s storage) and carry a request id.
- Dates in file names and reminder ids use the German calendar day instead of UTC.

### Security
- Students can no longer change their own e-mail, streak, licence class, current topic or created date (mass assignment).
- Password reset only works right after opening a recovery link (no password change on an unlocked, signed-in device).
- Sign-out removes the device's push token.
- Account / student deletion also deletes stored documents (GDPR erasure).
- Uploaded document names are generated; the extension comes from the validated file type (path traversal).
- Secrets compared in constant time; 11 missing foreign-key indexes added.

## [1.0.1] — 2026-11-09
- Official source links + "not a government app" disclaimer, German lesson titles, layered lion mascot, admin back button.

## [1.0.0] — 2026-10-28
- First store release.
