# Security policy

## Reporting a vulnerability

Please report it privately through the contact address on the app's store listing, with steps to reproduce. Don't open a public issue. We answer within
3 working days and fix critical issues as fast as possible. Please don't access other people's data
or run load tests against production while researching.

## How the app is protected (short version)

* **Authentication**: Supabase Auth (passwords salted + hashed with bcrypt, short-lived JWT access tokens refreshed automatically, revocable refresh tokens). Leaked passwords are refused (HaveIBeenPwned k-anonymity).
* **Authorization**: role-based (student/admin) and enforced in the database with Row Level Security on every table, plus column guards against mass assignment. Edge functions re-check the role server-side.
* **Input validation** on the server (edge functions + check constraints), output encoding (HTML-escaped e-mails, CSV formula neutralising), parameterised queries only.
* **Transport & browser**: HTTPS only (HSTS preload), strict Content-Security-Policy, `frame-ancestors 'none'` / `X-Frame-Options: DENY`, `nosniff`, Referrer- and Permissions-Policy.
* **Secrets** only in Supabase/Vault/EAS/GitHub secrets; CI fails if one appears in the web bundle.
* **Rate limiting / brute force**: shared database rate limiter on sign-up, imports, deletes; Supabase Auth limits on login; app-side backoff after wrong passwords.
* **Audit log** of privileged changes; **dependency scanning** (Dependabot + CI audit gate).

Details: `docs/OPERATIONS.md`, `docs/API.md` and the engineering-practices report.
