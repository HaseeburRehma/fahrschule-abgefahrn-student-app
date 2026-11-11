# Student import, invites & performance tracking

Admins (web app and mobile app → Profil → Administration) can:

- **Import students** from Excel `.xlsx`, LibreOffice/Numbers `.ods`, `.csv` (comma or
  semicolon), `.tsv`, `.txt`, or a list pasted from Excel / Google Sheets. Columns are
  matched automatically (German and English headers) and can be changed in the preview.
  Every row is checked before anything is saved.
- **Student codes**: a code in the file is kept. Students without one get a generated code
  (`XXXX-XXXX`, no look-alike characters). Every existing student without a code got one
  through the migration, and new students get one automatically.
- **Invites by e-mail**: each invited student receives their code, links to the App Store,
  Google Play and the web app, and the steps to sign up. Sign-up accepts the personal code
  **only together with the invited e-mail address**. The shared school code still works.
- **Invites screen**: status (open / sent / failed / signed up / revoked), search, resend
  or revoke one or many, copy (web) or share (phone, e.g. WhatsApp) the invite text.
- **Import history**: every list with its per-row outcome, plus the original file (private
  storage bucket `student-imports`).
- **Performance**: KPIs, filters (inactive, exam soon, needs help, exam ready, new),
  sorting, CSV export, and per student: score per theory topic and the latest quiz rounds.

## Deploy (one time)

The Supabase project is `fzolxwxdeyshtodlikkl`.

1. **Database**: run `supabase/migrations/20261110000001_student_invites.sql` in the
   Dashboard → SQL Editor (or `supabase db push`). It:
   - adds `profiles.student_code` and backfills a code for every student,
   - creates `student_invites` and `student_imports` (admin-only RLS),
   - creates the private bucket `student-imports`,
   - adds `admin_student_performance()` and `admin_student_topic_stats()`.
2. **Edge functions**:
   ```bash
   npx supabase login
   npx supabase link --project-ref fzolxwxdeyshtodlikkl
   npx supabase functions deploy admin-invite-students
   npx supabase functions deploy signup-with-code --no-verify-jwt
   ```
   Both import `supabase/functions/_shared/invites.ts`; the CLI bundles it automatically.
3. **E-mail (Resend)**: Dashboard → Edge Functions → Secrets:
   - `RESEND_API_KEY`: the Resend key (the project's local `.env` already has one).
   - `MAIL_FROM`, e.g. `Fahrschule Abgefahrn <app@fahrschule-abgefahrn.de>`. The domain must
     be verified in Resend (DNS records: SPF/DKIM).
   - `MAIL_REPLY_TO` (optional), e.g. `info@fahrschule-abgefahrn.de`.
   - `APP_WEB_URL` (optional): link to the web app shown in the mail.

   Without `RESEND_API_KEY` / `MAIL_FROM`, imports still work: invites and codes are saved,
   the screen says sending isn't set up, and the admin can copy / share the text.
4. **App**: JS-only change. Web deploys with Vercel. For iOS/Android use
   `npx eas-cli update --channel production` (no new store build needed; the
   `fflate` dependency is pure JavaScript).

## Order matters

Deploy the migration **before** the functions. Until both are live, the admin screens
show "Server-Update fehlt noch" and sign-up keeps working with the school code.

## Limits

- 10 MB per file, 2,000 rows per import, 500 invites per send action.
- Resend default rate limit: 2 requests/second; invites go out in batches of 100.
- A resend for the same invite is ignored within 60 seconds (double-click protection).
- Old binary Excel `.xls` is rejected with a hint to save as `.xlsx` or CSV.

## Security notes

- Everything is admin-only: RLS on both tables, `is_admin()` checks in both RPCs, and the
  edge function verifies the caller's JWT and admin role before using the service role.
- Students can't change their own `student_code` (guard trigger); only admins and the
  server can.
- Names from uploaded lists are HTML-escaped in the e-mail; CSV export neutralises
  formula cells (`=`, `+`, `-`, `@`).
- Zip-based files are unpacked with a size cap (60 MB uncompressed) against zip bombs.
