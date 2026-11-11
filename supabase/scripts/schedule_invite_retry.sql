-- ============================================================================
-- Background retry worker for invite e-mails — run once in the SQL editor
-- (after migration 20261111000002_worker_secret.sql).
--
-- 1. Generates a random secret inside the database and stores it in Vault
--    (nobody ever sees or copies it).
-- 2. Every 10 minutes pg_cron calls admin-invite-students { action: 'retry' }
--    through pg_net with that secret; the function checks it with
--    public.verify_worker_secret().
--
-- Rotate the secret:  delete from vault.secrets where name = 'invite_worker_secret';
--                     then run this script again.
-- Stop the worker:    select cron.unschedule('invite-retry');
-- ============================================================================
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'invite_worker_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'invite_worker_secret',
      'pg_cron retry worker -> edge function admin-invite-students'
    );
  end if;
end $$;

select cron.schedule(
  'invite-retry',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := 'https://fzolxwxdeyshtodlikkl.supabase.co/functions/v1/admin-invite-students',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'invite_worker_secret')
    ),
    body := '{"action":"retry"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);

-- Check: select jobname, schedule, active from cron.job where jobname = 'invite-retry';
