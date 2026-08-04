# Website → App intake (WordPress "Online Anmeldung" form)

When someone submits the sign-up form on https://fahrschule-abgefahrn.de/, we
want that submission to appear in the app's **Admin → Anmeldungen** queue so an
admin can convert it into a student account (or dismiss it).

This is done with **one webhook** from the WordPress form to the
`intake-signup` Supabase Edge Function. Manual admin entry (Admin → Fahrschüler
→ hinzufügen) works independently and needs none of this.

---

## 1. The endpoint

```
POST https://<YOUR-PROJECT-REF>.functions.supabase.co/intake-signup
```

- Header `x-intake-secret: <INTAKE_SECRET>` (the secret you set on the function —
  see the main README, step "Edge Function secrets"). Alternatively append
  `?secret=<INTAKE_SECRET>` to the URL if your form tool can't set headers.
- Body: JSON **or** `application/x-www-form-urlencoded`. Field names are matched
  loosely, so most form plugins work without renaming anything.

### Field mapping (candidate names → column)

| App column       | Accepted field names (case-insensitive)                     |
|------------------|-------------------------------------------------------------|
| `first_name`     | `first_name`, `vorname`, `firstname`, `fname`               |
| `last_name`      | `last_name`, `nachname`, `lastname`, `lname`, `name`        |
| `email`          | `email`, `e-mail`, `e_mail`, `mail`                         |
| `phone`          | `phone`, `nummer`, `telefon`, `tel`, `mobile`, `handy`      |
| `service_label`  | `service`, `paket`, `package`, `kurs`, `angebot`, `leistung`|
| `payment`        | `payment`, `zahlung`, `zahlungsart`, `bezahlung`            |

Everything submitted is also stored verbatim in `raw` (jsonb), so nothing is
lost even if a field isn't in the table above.

---

## 2. Wiring it up in WordPress

Pick whichever matches the form plugin currently used on the site:

**A. The form plugin has a native webhook/POST action** (Elementor Pro Forms,
WPForms, Fluent Forms, Gravity Forms + Webhooks, Forminator, etc.)
1. Add a **Webhook** action to the "Online Anmeldung" form.
2. URL = the endpoint above. Method = `POST`.
3. Add header `x-intake-secret` = your `INTAKE_SECRET` (or use `?secret=`).
4. Map the form fields — or just send all fields; loose matching handles it.

**B. No native webhook** → install a lightweight bridge plugin such as
**"WP Webhooks"** and trigger "Send Data on Form Submission" to the same URL.

**C. Zapier / Make** → trigger on the form submission, add a "Webhook → POST"
step to the endpoint with the secret header and the field mapping above.

---

## 3. Test it

```bash
curl -X POST "https://<YOUR-PROJECT-REF>.functions.supabase.co/intake-signup" \
  -H "content-type: application/json" \
  -H "x-intake-secret: <INTAKE_SECRET>" \
  -d '{"vorname":"Max","nachname":"Mustermann","email":"max@example.com","nummer":"+49 170 0000000","paket":"Grundbetrag - 99€"}'
```

Expected: `{"ok":true,"id":"..."}`. The submission then shows up under
**Admin → Anmeldungen**; tap **In Fahrschüler umwandeln** to create the account
(the student can then sign in with their email + the 6-digit code).

> Security note: the form only ever *creates a pending intake row*. It cannot
> create accounts or read data. Account creation is a separate, admin-only step
> inside the app.
