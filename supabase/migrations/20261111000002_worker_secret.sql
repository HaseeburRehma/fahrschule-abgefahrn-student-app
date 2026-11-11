-- ============================================================================
-- Background worker authentication without a hand-copied secret.
--
-- supabase/scripts/schedule_invite_retry.sql generates a random secret INSIDE
-- the database and keeps it in Vault ('invite_worker_secret'); the pg_cron job
-- sends it to admin-invite-students, which asks this function whether it
-- matches. The value never appears in a dashboard, chat, file or git.
-- Rotate: delete the Vault secret and run the schedule script again.
-- Only the service role (edge functions) may call it.
-- ============================================================================
create or replace function public.verify_worker_secret(p_secret text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  expected text;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 200 then
    return false;
  end if;
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
      into expected using 'invite_worker_secret';
  exception when others then
    return false; -- Vault not available (local tests) → never authorised
  end;
  if expected is null then
    return false;
  end if;
  -- Compare fixed-length hashes, not the raw strings.
  return sha256(convert_to(p_secret, 'UTF8')) = sha256(convert_to(expected, 'UTF8'));
end $$;
revoke execute on function public.verify_worker_secret(text) from public, anon, authenticated;
grant execute on function public.verify_worker_secret(text) to service_role;
