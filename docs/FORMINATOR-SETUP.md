# Connect the Forminator "Online Anmeldung" form to the app

Your site uses **Forminator Pro**. This wires the **Online Anmeldung** form so
every submission lands in the app's **Admin → Anmeldungen** queue, where an
admin converts it into a student (or dismisses it). Manual admin entry works
independently and needs none of this.

The bridge is the **`intake-signup`** Supabase Edge Function (already deployed).
It accepts JSON **or** form-encoded bodies and matches field names loosely
(exact → substring), so Forminator's field IDs like `email-1`, `name-1-first-name`
are detected automatically. The **full submission is always stored** in the
`raw` column, so nothing is ever lost even if a field isn't auto-mapped.

---

## Endpoint

```
POST https://fzolxwxdeyshtodlikkl.functions.supabase.co/intake-signup?secret=<INTAKE_SECRET>
```

`<INTAKE_SECRET>` is the shared secret set on the function (kept out of this repo
on purpose). Ask the developer for the current value, or reset it with
`supabase secrets set INTAKE_SECRET=… --project-ref fzolxwxdeyshtodlikkl`.

---

## Steps in WordPress (Forminator Pro)

1. **Forminator → Integrations** → find **Webhooks** → **Activate** (if not already).
2. **Forminator → Forms** → hover **Online Anmeldung** → **Edit**.
3. Open the **Integrations / Connect an app** tab of the form → choose **Webhooks** → **Add Webhook**.
4. Fill in:
   - **Webhook URL**: the endpoint above, with `?secret=<INTAKE_SECRET>` appended.
   - **Request method**: `POST`.
   - **Request format**: JSON (form-encoded also works).
5. **Save** the integration, then **Update / Publish** the form.

> Forminator's basic webhook may not let you add custom HTTP headers — that's why
> the secret goes in the URL as `?secret=…`. If your Forminator version *does*
> allow headers, you can instead send `x-intake-secret: <INTAKE_SECRET>`.

---

## Test it

1. Open the live page with the form and submit a test entry (real-looking email).
2. In the app (signed in as an admin) → **Admin → Anmeldungen** → the submission
   appears. Tap **In Fahrschüler umwandeln** to create the account; the student
   can then sign in with their email + 6-digit code.

You can also test the endpoint directly:

```bash
curl -X POST "https://fzolxwxdeyshtodlikkl.functions.supabase.co/intake-signup?secret=<INTAKE_SECRET>" \
  -H "content-type: application/json" \
  -d '{"vorname":"Max","nachname":"Mustermann","email":"max@example.com","nummer":"+49 170 0000000","paket":"Grundbetrag - 99€"}'
```

Expected: `{"ok":true,"id":"…"}`.

---

## If a field doesn't populate in the queue

Forminator sometimes uses generic field IDs (e.g. `text-2` for a plain text
field) that carry no hint of what they hold. The critical field — **email** —
is a Forminator *Email* field (`email-1`), so it's always detected, and the raw
submission is stored regardless. If **Vorname/Nachname/Telefon** come through
empty, send one test submission's `raw` JSON (visible in Supabase → Table
Editor → `signup_intake`) and the developer will map those exact field IDs in
one line.

> Security: the form can only *create a pending intake row*. It cannot create
> accounts or read any data — account creation is a separate, admin-only step
> inside the app.
