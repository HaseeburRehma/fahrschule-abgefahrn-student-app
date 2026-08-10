# Native builds & store release (EAS)

Everything below runs from the project root. The web app already deploys to
Vercel; this ships the **iOS + Android** apps and turns on **on-device push**.

## 0. Prerequisites (one-time)
- An **Expo account** (free): https://expo.dev
- **Apple Developer** account ($99/yr) for iOS
- **Google Play Developer** account ($25 once) for Android
- EAS CLI: `npm i -g eas-cli`

## 1. Link the project to Expo
```bash
eas login
eas init          # creates the EAS project, writes extra.eas.projectId + owner into app.json
```
This is the step that fills the two fields intentionally left blank in `app.json`
(`owner`, `extra.eas.projectId`). Commit the change.

## 2. Turn on push (adds the EAS project id the app reads)
Push token registration already exists (`lib/notifications/push.ts`); it just
needs the project id from step 1. Then wire the DB → push:

- Supabase → **Database → Webhooks → Create** on `public.notifications` (Insert),
  HTTP POST to `https://fzolxwxdeyshtodlikkl.functions.supabase.co/push-dispatch`.
  *(Or the `pg_net` trigger `trg_dispatch_push` we already installed does this —
  it's live, so on-device push works as soon as a build registers a token.)*

## 3. Build
```bash
eas build --platform android --profile production   # .aab for Play
eas build --platform ios --profile production       # for App Store
# or both:
eas build --platform all --profile production
```
Profiles are defined in `eas.json` (`development` = dev client APK,
`preview` = internal APK / simulator, `production` = store artifacts).
`autoIncrement` bumps the build number automatically on production.

For a quick internal test build first:
```bash
eas build --platform android --profile preview      # installable APK
```

## 4. Submit to the stores
```bash
eas submit --platform android --latest
eas submit --platform ios --latest
```
Fill the submit credentials the first time (or add them to `eas.json → submit`):
- **iOS**: `ascAppId` (App Store Connect app id), `appleId`, `appleTeamId`
- **Android**: a Google Play **service-account JSON** (Play Console → API access) →
  save as `google-play-service-account.json` (already git-ignored) and reference it.

## 5. Store listing assets (already prepared in `assets/`)
- **App icon** 1024×1024 → `assets/icon.png` ✅
- **Adaptive icon** → `assets/adaptive-icon.png` ✅
- **Splash** → `assets/splash.png` ✅
- **Play feature graphic** 1024×500 → `assets/feature-graphic.png` ✅
- **Screenshots** — capture from the running app (phone + tablet). *TODO before submit.*
- **Privacy policy URL** → https://fahrschule-abgefahrn.de/datenschutz/ ✅ (also linked in-app)
- Short/long description, category = *Education*, support email `info@fahrschule-abgefahrn.de`.

## 6. Over-the-air updates (after the first store build)
Ship JS-only changes without a new store review:
```bash
eas update:configure          # once
eas update --branch production --message "…"
```

## Notes / gotchas
- Bundle ids are set in `app.json`: iOS `de.fahrschuleabgefahrn.app`,
  Android `de.fahrschuleabgefahrn.app`. Don't change them after the first submit.
- Bump `expo.version` in `app.json` for each store release (e.g. 1.0.0 → 1.0.1).
- iOS requires an **account-deletion** path — already built (Settings → Delete account).
- The app is invite-only (OTP, admin-provisioned); note this in the App Review
  notes and provide a **demo login** (a test student email you can read the code for).
- Face ID usage string is in `app.json` (`expo-local-authentication` plugin).
