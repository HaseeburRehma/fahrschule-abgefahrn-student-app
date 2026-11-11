-- ============================================================================
-- OPTIONAL — background retry worker for invite e-mails (run once, by hand).
--
-- Every 10 minutes pg_cron calls admin-invite-students { action: 'retry' }
-- through pg_net. The function re-sends failed invites whose backoff expired.
--
-- Before running:
--   1. Pick a long random secret, e.g.  openssl rand -hex 32
--   2. Dashboard → Edge Functions → Secrets: CRON_SECRET = <that value>
--   3. Store the same value + the project URL in Vault (SQL editor):
--        select vault.create_secret('<that value>', 'invite_worker_secret');
--        select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
-- Secrets live only in Vault / function secrets — never in this file or git.
-- Rotate: update both places, nothing else changes.
-- ============================================================================
select cron.schedule(
  'invite-retry',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/admin-invite-students',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'invite_worker_secret')
    ),
    body := '{"action":"retry"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
-- Undo: select cron.unschedule('invite-retry');
