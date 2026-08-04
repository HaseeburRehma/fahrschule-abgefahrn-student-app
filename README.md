# Fahrschule Abgefahrn — Student Notification App

A cross-platform (Web · iOS · Android) notification app for driving-school
students, built with **Expo (React Native + react-native-web)** and
**Supabase**. German by default, with English translation.

- **Students** sign in passwordlessly (email → 6-digit code), and see their
  package(s), current theory class, appointment schedule, the 14 theory topics,
  and a live notifications feed with push.
- **Admins** add/edit students, assign packages + theory class, review website
  sign-ups, create theory classes + enroll students, and send notifications.

The web build deploys to **Vercel**; native builds go through **EAS**.

---

## Stack

| Area           | Choice                                                        |
|----------------|--------------------------------------------------------------|
| Framework      | Expo SDK 54, expo-router (file-based routes)                  |
| Styling        | NativeWind (Tailwind) — brand green `#22C55E` on near-black   |
| Backend        | Supabase (Postgres + Auth + RLS + Realtime + Edge Functions) |
| Auth           | Passwordless email OTP (`signInWithOtp` / `verifyOtp`)        |
| Push           | expo-notifications (Expo push tokens) + `push-dispatch` fn    |
| i18n           | Custom dictionary (`lib/i18n`), German default               |

### Project layout

```
app/                     expo-router routes
  (auth)/login.tsx       passwordless OTP sign-in
  (tabs)/                student: home, notifications, theory, schedule, settings
  admin/                 admin: students, intake, notify, classes  (admin-gated)
lib/                     supabase client, i18n, auth, rbac, data, admin helpers
components/              ui kit, AuthGuard, providers
supabase/migrations/     schema + RLS + seed (deploy these)
supabase/functions/      push-dispatch, admin-create-student, intake-signup
docs/WORDPRESS-INTAKE.md website → app form wiring
```

---

## Local development

```bash
npm install
cp .env.example .env          # fill in Supabase URL + anon key
npm run web                   # open http://localhost:8081 (or --port)
```

`npm run typecheck` and `npx expo-doctor` should be clean.

---

## Deploy — one-time setup

### 1. Create the Supabase project
Create a new project at https://supabase.com. From **Project Settings → API**
copy the **Project URL** and **anon public** key into `.env`
(`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).

### 2. Apply the database migrations
Using the Supabase CLI (recommended):
```bash
supabase link --project-ref <YOUR-PROJECT-REF>
supabase db push          # applies supabase/migrations/*.sql
```
Or paste the three files in `supabase/migrations/` into the SQL editor **in
order** (`_schema`, `_rls`, `_seed`). This creates all tables, RLS policies,
and seeds the 8 packages + 14 theory topics.

### 3. Make yourself an admin (bootstrap)
Auth is invite-only (`shouldCreateUser: false`), so first create your own auth
user: **Authentication → Users → Add user** (email, "Auto Confirm"). Then in the
SQL editor:
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```
Now you can sign in (email → code) and reach the Admin area.

### 4. Deploy the Edge Functions
```bash
supabase functions deploy push-dispatch --no-verify-jwt
supabase functions deploy admin-create-student
supabase functions deploy intake-signup --no-verify-jwt
```

### 5. Edge Function secrets
```bash
# Shared secret the WordPress form must send (see docs/WORDPRESS-INTAKE.md)
supabase secrets set INTAKE_SECRET="<a-long-random-string>"
# Optional: require the DB webhook to authenticate to push-dispatch
supabase secrets set WEBHOOK_SECRET="<another-random-string>"
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected automatically — do **not** set them yourself.

### 6. Wire the push trigger (Database Webhook)
**Database → Webhooks → Create** a webhook:
- Table `public.notifications`, event **Insert**
- Type **HTTP Request**, method **POST**, URL = your `push-dispatch` function URL
  (`https://<REF>.functions.supabase.co/push-dispatch`)
- If you set `WEBHOOK_SECRET`, add header `x-webhook-secret: <that value>`

Now every inserted notification is delivered to the recipient's device (web
clients get it instantly via the realtime feed regardless).

### 7. Website intake
Follow **`docs/WORDPRESS-INTAKE.md`** to add one webhook from the "Online
Anmeldung" form to the `intake-signup` function.

---

## Deploy — Web (Vercel)

1. Push this folder to a Git repo and import it in Vercel.
2. `vercel.json` is already configured (build `expo export --platform web` →
   `dist/`, SPA rewrites, asset caching).
3. In Vercel → **Settings → Environment Variables**, add
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. To verify locally: `npm run build` then serve `dist/`
   (`index.html` must exist).

---

## Deploy — Native (iOS / Android)

Push notifications on device require an EAS project id.

```bash
npm i -g eas-cli && eas login
eas init                       # writes extra.eas.projectId + owner into app.json
eas build --platform all --profile production
eas submit --platform ios --latest      # after configuring App Store Connect
eas submit --platform android --latest   # after adding a Play service account
```

Update `app.json` bundle identifiers (`de.fahrschuleabgefahrn.app`) and the
`owner` field to your Expo account before building. Replace the placeholder
brand assets in `assets/` (icon, splash, adaptive-icon, notification-icon,
favicon) with the real Fahrschule Abgefahrn artwork.

---

## How the pieces fit

```
Website form ──(webhook)──► intake-signup ──► signup_intake (pending)
                                                    │ admin: "convert"
Admin app ──► admin-create-student ──► auth user + profile (student)
                                                    │
Student ──► OTP sign-in ──► sees package / theory class / schedule / feed
                                                    ▲
Admin ──► "send notification" ──► notifications INSERT
              └─(DB webhook)─► push-dispatch ─► Expo push ─► device
```
