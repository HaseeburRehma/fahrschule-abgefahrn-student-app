-- ============================================================================
-- Platform hardening (2026-11-11)
--
--   1. Indexes for every foreign key that had none
--   2. Profiles: close mass-assignment gaps (students could rewrite their own
--      e-mail, streak, licence class …) + length limits
--   3. Shared rate limiting (fixed window, atomic, works across instances)
--   4. Append-only audit log with data minimisation
--   5. Idempotent imports, invite delivery tracking + retry queue, webhook dedupe
--   6. Feature flags (kill switches) readable by the app
--   7. Scheduled maintenance with pg_cron (retention / data minimisation)
--
-- Safe to run more than once. Run it in the SQL editor or `supabase db push`.
-- ============================================================================

-- ── 1. foreign-key indexes ──────────────────────────────────────────────────
-- Without these, deleting a parent row or joining on the FK scans the whole child table.
create index if not exists appointments_slot_id_idx            on public.appointments (slot_id);
create index if not exists chat_messages_sender_id_idx         on public.chat_messages (sender_id);
create index if not exists class_enrollments_class_id_idx      on public.class_enrollments (class_id);
create index if not exists class_rsvp_class_id_idx             on public.class_rsvp (class_id);
create index if not exists profiles_current_topic_idx          on public.profiles (current_theory_topic_id);
create index if not exists student_imports_created_by_idx      on public.student_imports (created_by);
create index if not exists student_invites_created_by_idx      on public.student_invites (created_by);
create index if not exists student_invites_profile_id_idx      on public.student_invites (profile_id);
create index if not exists student_packages_package_id_idx     on public.student_packages (package_id);
create index if not exists theory_classes_topic_id_idx         on public.theory_classes (topic_id);
create index if not exists topic_progress_topic_id_idx         on public.topic_progress (topic_id);

-- ── 2. profiles: privileged columns + limits ────────────────────────────────
-- RLS limits WHICH rows a student may update (their own); this trigger limits
-- WHICH columns. Before: role / is_active / student_code. Now also e-mail (other
-- functions match accounts by it), streak fields, licence class, current topic
-- and created_at. Trusted SQL functions (touch_streak) set app.trusted_write.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if coalesce(auth.role(), '') in ('authenticated', 'anon') then
      new.student_code := old.student_code;
      new.email := old.email;
      new.license_class := old.license_class;
      new.current_theory_topic_id := old.current_theory_topic_id;
      new.created_at := old.created_at;
      if coalesce(current_setting('app.trusted_write', true), '') <> 'on' then
        new.streak_days := old.streak_days;
        new.last_active_on := old.last_active_on;
      end if;
    end if;
    new.role := old.role;
    new.is_active := old.is_active;
    return new;
  end if;
  -- admin is changing someone: never remove/deactivate the last active admin
  if old.role = 'admin' and old.is_active and (new.role <> 'admin' or not new.is_active) then
    if not exists (
      select 1 from public.profiles
      where role = 'admin' and is_active and id <> old.id
    ) then
      raise exception 'last_admin' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_profile_privileges() from public, anon, authenticated;

-- touch_streak is the only legitimate writer of the streak fields.
create or replace function public.touch_streak()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  today date := (now() at time zone 'Europe/Berlin')::date;
  s int;
begin
  select streak_days, last_active_on into p from profiles where id = auth.uid();
  if not found then return 0; end if;
  if p.last_active_on = today then
    return p.streak_days;
  elsif p.last_active_on = today - 1 then
    s := coalesce(p.streak_days, 0) + 1;
  else
    s := 1;
  end if;
  perform set_config('app.trusted_write', 'on', true);
  update profiles set streak_days = s, last_active_on = today where id = auth.uid();
  perform set_config('app.trusted_write', '', true);
  return s;
end;
$$;
grant execute on function public.touch_streak() to authenticated;

-- Length limits (server-side data validation). NOT VALID = existing rows are
-- not re-checked, every new write is.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_text_lengths') then
    alter table public.profiles add constraint profiles_text_lengths check (
      coalesce(length(first_name), 0) <= 100 and coalesce(length(last_name), 0) <= 100
      and coalesce(length(phone), 0) <= 40 and coalesce(length(email), 0) <= 320
      and coalesce(length(push_token), 0) <= 300
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'student_invites_email_format') then
    alter table public.student_invites add constraint student_invites_email_format
      check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(email) <= 320) not valid;
  end if;
end $$;

-- ── 3. rate limiting ────────────────────────────────────────────────────────
-- Fixed window per key, e.g. 'signup:ip:1.2.3.4'. The upsert is atomic, so
-- parallel requests can't race past the limit. Only the service role (edge
-- functions) may call it.
create table if not exists public.rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  hits         int         not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security; -- no policies: clients can't touch it
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns table (allowed boolean, current_hits int, retry_after int)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  w timestamptz;
  n int;
begin
  if p_key is null or length(p_key) > 200 or p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid_rate_limit_args' using errcode = '22023';
  end if;
  w := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into n;
  return query select n <= p_limit, n,
    greatest(1, ceil(extract(epoch from (w + make_interval(secs => p_window_seconds) - now()))))::int;
end $$;
revoke execute on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

-- ── 4. audit log ────────────────────────────────────────────────────────────
-- Who changed what, when. Append-only for every API role; admins can read it.
-- Data minimisation: only the columns named per trigger are recorded, and the
-- school sign-up code is never written in clear text.
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,
  actor_role  text,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name  text not null,
  record_id   text,
  changes     jsonb not null default '{}'
);
create index if not exists audit_log_at_idx     on public.audit_log (at desc);
create index if not exists audit_log_record_idx on public.audit_log (table_name, record_id);
create index if not exists audit_log_actor_idx  on public.audit_log (actor_id);
alter table public.audit_log enable row level security;
drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log for select using (public.is_admin());
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated, service_role;
grant select on public.audit_log to authenticated;

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cols   text[] := tg_argv;                 -- columns worth recording
  o      jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n      jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  diff   jsonb := '{}';
  c      text;
  rec_id text := coalesce(n ->> 'id', o ->> 'id', n ->> 'key', o ->> 'key');
  secret boolean := tg_table_name = 'app_settings'
                    and coalesce(n ->> 'key', o ->> 'key') not like 'feature.%';
begin
  foreach c in array cols loop
    if tg_op = 'UPDATE' then
      if (o -> c) is distinct from (n -> c) then
        diff := diff || jsonb_build_object(c, case when secret and c = 'value' then '"[changed]"'::jsonb
                                                 else jsonb_build_object('old', o -> c, 'new', n -> c) end);
      end if;
    elsif tg_op = 'INSERT' then
      diff := diff || jsonb_build_object(c, case when secret and c = 'value' then '"[set]"'::jsonb else n -> c end);
    end if;
  end loop;
  if tg_op = 'UPDATE' and diff = '{}' then
    return null; -- nothing we track changed
  end if;
  insert into public.audit_log (actor_id, actor_role, action, table_name, record_id, changes)
  values (auth.uid(), coalesce(auth.role(), current_user), tg_op, tg_table_name, rec_id, diff);
  return null;
end $$;
revoke execute on function public.audit_row() from public, anon, authenticated;

drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles
  after update or delete on public.profiles
  for each row execute function public.audit_row('role', 'is_active', 'student_code', 'email', 'license_class');

drop trigger if exists trg_audit_student_invites on public.student_invites;
create trigger trg_audit_student_invites
  after insert or update or delete on public.student_invites
  for each row execute function public.audit_row('status', 'student_code', 'code_source', 'send_count', 'delivery_status', 'import_id');

drop trigger if exists trg_audit_student_imports on public.student_imports;
create trigger trg_audit_student_imports
  after insert or delete on public.student_imports
  for each row execute function public.audit_row('file_format', 'total_rows', 'created_by');

drop trigger if exists trg_audit_app_settings on public.app_settings;
create trigger trg_audit_app_settings
  after insert or update or delete on public.app_settings
  for each row execute function public.audit_row('key', 'value');

-- ── 5a. idempotent imports ──────────────────────────────────────────────────
-- The app sends an Idempotency-Key per import; a retried or double-tapped
-- request returns the first result instead of importing twice.
alter table public.student_imports add column if not exists idempotency_key uuid;
alter table public.student_imports add column if not exists completed_at timestamptz;
create unique index if not exists student_imports_idempotency_idx
  on public.student_imports (created_by, idempotency_key) where idempotency_key is not null;

-- ── 5b. invite delivery tracking + retry queue ──────────────────────────────
-- Failed sends are retried later with exponential backoff (attempts,
-- next_attempt_at) by the background worker; Resend's webhook reports
-- delivered / bounced / complained per message id.
alter table public.student_invites add column if not exists provider_message_id text;
alter table public.student_invites add column if not exists delivery_status text;
alter table public.student_invites add column if not exists delivery_updated_at timestamptz;
alter table public.student_invites add column if not exists attempts int not null default 0;
alter table public.student_invites add column if not exists next_attempt_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'student_invites_delivery_status_check') then
    alter table public.student_invites add constraint student_invites_delivery_status_check
      check (delivery_status is null or delivery_status in ('delivered', 'bounced', 'complained', 'delayed'));
  end if;
end $$;
create index if not exists student_invites_provider_msg_idx
  on public.student_invites (provider_message_id) where provider_message_id is not null;
create index if not exists student_invites_retry_idx
  on public.student_invites (next_attempt_at) where status = 'failed';

-- Webhook deliveries seen (dedupe by the provider's message id → idempotent handling).
create table if not exists public.webhook_events (
  id          text primary key,
  source      text not null,
  type        text not null,
  received_at timestamptz not null default now()
);
alter table public.webhook_events enable row level security; -- service role only
revoke all on public.webhook_events from anon, authenticated;

-- ── 6. feature flags ────────────────────────────────────────────────────────
-- Stored in app_settings as 'feature.<name>' = 'on' | 'off'. Admins switch them
-- (Administration → Anmeldecode & Schalter); everyone may read them.
insert into public.app_settings (key, value) values
  ('feature.invite_emails', 'on'),
  ('feature.student_import', 'on'),
  ('feature.performance_dashboard', 'on')
on conflict (key) do nothing;

create or replace function public.feature_flags()
returns table (key text, enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  select substr(s.key, 9), s.value = 'on'
  from public.app_settings s
  where s.key like 'feature.%'
$$;
revoke execute on function public.feature_flags() from public;
grant execute on function public.feature_flags() to anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_settings_feature_values') then
    alter table public.app_settings add constraint app_settings_feature_values
      check (key not like 'feature.%' or value in ('on', 'off'));
  end if;
end $$;

-- app_settings.updated_at was only set by the client; set it on every write.
create or replace function public.touch_app_settings()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_app_settings_touch on public.app_settings;
create trigger trg_app_settings_touch before insert or update on public.app_settings
  for each row execute function public.touch_app_settings();

-- ── 7. scheduled maintenance (pg_cron) ──────────────────────────────────────
-- Skipped with a notice where pg_cron isn't available (local tests).
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available — maintenance jobs not scheduled';
    return;
  end if;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('purge-rate-limits', '17 * * * *',
    $j$delete from public.rate_limits where window_start < now() - interval '1 day'$j$);
  perform cron.schedule('purge-webhook-events', '23 3 * * *',
    $j$delete from public.webhook_events where received_at < now() - interval '30 days'$j$);
  -- GDPR data minimisation: per-row import details (names, e-mails) are only
  -- needed while the import is fresh; the summary counts stay.
  perform cron.schedule('minimise-old-imports', '41 3 * * *',
    $j$update public.student_imports set rows = null where rows is not null and created_at < now() - interval '180 days'$j$);
  perform cron.schedule('audit-log-retention', '5 4 * * 0',
    $j$delete from public.audit_log where at < now() - interval '2 years'$j$);
exception when others then
  raise notice 'maintenance jobs not scheduled: %', sqlerrm;
end $$;
