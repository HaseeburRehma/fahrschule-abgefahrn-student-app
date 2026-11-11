## What & why

<!-- One or two sentences. Link the issue if there is one. -->

## Checklist (code review)

- [ ] CI is green (typecheck, unit, Deno, database/RLS tests, Docker, bundle budget)
- [ ] New tables have RLS + policies, and a test in `supabase/tests/`
- [ ] Inputs are validated on the server (edge function / constraint), not only in the app
- [ ] No secrets, personal data or the school sign-up code in code, logs or screenshots
- [ ] Migration is idempotent (`if not exists`, `create or replace`) and safe on live data
- [ ] User-facing text exists in German and English
- [ ] Tested on a phone width and on desktop web
- [ ] `CHANGELOG.md` updated; version bumped if this ships to the stores (see docs/OPERATIONS.md)
