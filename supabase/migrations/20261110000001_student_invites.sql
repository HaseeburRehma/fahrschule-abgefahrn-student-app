-- ============================================================================
-- Student codes, bulk invites, import history and performance tracking.
--
--  * profiles.student_code   personal code for every student. Generated
--                            automatically when a student has none (backfill
--                            below + trigger for new students). Only admins and
--                            the server can change it.
--  * student_imports         one row per uploaded list (file or paste), with the
--                            per-row outcome kept as JSON so the admin can look
--                            at it later. The original file sits in the private
--                            `student-imports` storage bucket.
--  * student_invites         one row per invited e-mail address with its personal
--                            code and delivery status. The `signup-with-code` edge
--                            function accepts that code only together with the
--                            invited e-mail address.
--  * admin_student_performance() / admin_student_topic_stats()
--                            server-side aggregates for the admin dashboard.
--
-- Everything here is admin-only (RLS + is_admin() checks). Writes to invites
-- and imports happen through the `admin-invite-students` edge function.
-- ============================================================================

-- ── student codes ─────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists student_code text;

alter table public.profiles drop constraint if exists profiles_student_code_format;
alter table public.profiles add constraint profiles_student_code_format
  check (student_code is null or student_code ~ '^[A-Z0-9][A-Z0-9._/-]{2,31}$');

create unique index if not exists profiles_student_code_key
  on public.profiles (student_code) where student_code is not null;

-- 8 random characters from an alphabet without look-alikes (no 0/O/1/I), shown
-- as XXXX-XXXX. Randomness comes from gen_random_uuid() (cryptographically
-- random v4 UUID); bytes 6 and 8 carry the fixed version/variant bits and are
-- skipped. 32^8 ≈ 1.1e12 combinations.
create or replace function public.random_student_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  idx constant int[] := array[0, 1, 2, 3, 4, 5, 7, 9];
  b bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  s text := '';
  i int;
begin
  for i in 1..8 loop
    s := s || substr(alphabet, (get_byte(b, idx[i]) % 32) + 1, 1);
  end loop;
  return substr(s, 1, 4) || '-' || substr(s, 5, 4);
end $$;

-- ── invites + imports ─────────────────────────────────────────────────────────

create table if not exists public.student_imports (
  id                 uuid primary key default gen_random_uuid(),
  file_name          text not null check (char_length(file_name) between 1 and 255),
  file_format        text not null check (file_format in ('xlsx', 'ods', 'csv', 'tsv', 'txt', 'paste')),
  file_path          text check (file_path is null or char_length(file_path) <= 512),
  total_rows         int  not null default 0 check (total_rows >= 0),
  invited            int  not null default 0 check (invited >= 0),
  already_registered int  not null default 0 check (already_registered >= 0),
  skipped            int  not null default 0 check (skipped >= 0),
  emails_sent        int  not null default 0 check (emails_sent >= 0),
  emails_failed      int  not null default 0 check (emails_failed >= 0),
  -- [{row, email, first_name, last_name, student_code, outcome, reason}]
  rows               jsonb not null default '[]'::jsonb,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists student_imports_created_idx on public.student_imports (created_at desc);

create table if not exists public.student_invites (
  id           uuid primary key default gen_random_uuid(),
  import_id    uuid references public.student_imports (id) on delete set null,
  email        text not null check (email = lower(email) and char_length(email) between 3 and 254),
  first_name   text check (first_name is null or char_length(first_name) <= 60),
  last_name    text check (last_name is null or char_length(last_name) <= 60),
  phone        text check (phone is null or char_length(phone) <= 40),
  student_code text not null check (student_code ~ '^[A-Z0-9][A-Z0-9._/-]{2,31}$'),
  code_source  text not null default 'generated' check (code_source in ('file', 'generated', 'profile')),
  status       text not null default 'pending'
               check (status in ('pending', 'sent', 'failed', 'accepted', 'revoked')),
  send_count   int  not null default 0 check (send_count >= 0),
  last_sent_at timestamptz,
  last_error   text check (last_error is null or char_length(last_error) <= 500),
  accepted_at  timestamptz,
  profile_id   uuid references public.profiles (id) on delete set null,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists student_invites_email_key on public.student_invites (email);
create unique index if not exists student_invites_code_key on public.student_invites (student_code);
create index if not exists student_invites_import_idx on public.student_invites (import_id);
create index if not exists student_invites_status_idx on public.student_invites (status, created_at desc);

drop trigger if exists trg_student_invites_updated on public.student_invites;
create trigger trg_student_invites_updated before update on public.student_invites
  for each row execute function public.set_updated_at();

alter table public.student_imports enable row level security;
alter table public.student_invites enable row level security;

drop policy if exists student_imports_admin on public.student_imports;
create policy student_imports_admin on public.student_imports
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists student_invites_admin on public.student_invites;
create policy student_invites_admin on public.student_invites
  for all using (public.is_admin()) with check (public.is_admin());

-- A code that nobody uses yet: not on a profile, not on an invite, not the school code.
create or replace function public.new_student_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c text;
  n int := 0;
begin
  loop
    c := public.random_student_code();
    exit when not exists (select 1 from profiles where student_code = c)
          and not exists (select 1 from student_invites where student_code = c)
          and not exists (select 1 from app_settings where key = 'signup_code' and upper(value) = c);
    n := n + 1;
    if n > 20 then
      raise exception 'could not generate a unique student code';
    end if;
  end loop;
  return c;
end $$;

revoke execute on function public.random_student_code() from public, anon, authenticated;
revoke execute on function public.new_student_code() from public, anon, authenticated;
grant execute on function public.new_student_code() to service_role;

-- ── privileged columns: students can't change their own code ───────────────────
-- Same rules as before (role / is_active / last admin), plus student_code. Calls
-- made by the server (service role, SQL editor, migrations) may set the code.
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

-- Every student gets a code. Runs after trg_profiles_guard (triggers fire in
-- name order), so a code a student tried to clear is restored first.
create or replace function public.assign_student_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.student_code is not null then
    new.student_code := upper(regexp_replace(new.student_code, '\s+', '', 'g'));
  end if;
  if new.role = 'student' and new.student_code is null then
    new.student_code := public.new_student_code();
  end if;
  return new;
end $$;
revoke execute on function public.assign_student_code() from public, anon, authenticated;

drop trigger if exists trg_profiles_student_code on public.profiles;
create trigger trg_profiles_student_code
  before insert or update of role, student_code on public.profiles
  for each row execute function public.assign_student_code();

-- Backfill: existing students without a code get one now.
update public.profiles
   set student_code = public.new_student_code()
 where role = 'student' and student_code is null;

-- ── private bucket for uploaded lists ──────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-imports', 'student-imports', false, 10485760, -- 10 MB
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/tab-separated-values',
    'text/plain'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "student imports admin" on storage.objects;
create policy "student imports admin" on storage.objects
  for all to authenticated
  using (bucket_id = 'student-imports' and public.is_admin())
  with check (bucket_id = 'student-imports' and public.is_admin());

-- ── performance aggregates ─────────────────────────────────────────────────────

create or replace function public.admin_student_performance()
returns table (
  student_id          uuid,
  first_name          text,
  last_name           text,
  email               text,
  student_code        text,
  is_active           boolean,
  joined_at           timestamptz,
  last_active_on      date,
  streak_days         int,
  topics_done         int,
  topics_mastered     int,
  quiz_rounds         int,
  quiz_questions      int,
  quiz_correct        int,
  xp_total            int,
  xp_week             int,
  last_quiz_at        timestamptz,
  driving_lessons     int,
  lessons_completed   int,
  lessons_upcoming    int,
  drive_autobahn      boolean,
  drive_night         boolean,
  drive_overland      boolean,
  theory_exam_date    date,
  practical_exam_date date,
  theory_passed       boolean,
  practical_passed    boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  week_start timestamptz := date_trunc('week', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin';
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  with q as (
    select a.student_id as sid,
           count(*)::int as rounds,
           sum(a.total)::int as questions,
           sum(a.correct)::int as correct,
           sum(a.xp)::int as xp_total,
           coalesce(sum(a.xp) filter (where a.created_at >= week_start), 0)::int as xp_week,
           count(distinct a.topic_number) filter (where a.mastered)::int as mastered,
           max(a.created_at) as last_at
    from quiz_attempts a
    group by a.student_id
  ),
  t as (
    select tp.student_id as sid, count(*)::int as done
    from topic_progress tp
    group by tp.student_id
  ),
  ap as (
    select x.student_id as sid,
           count(*) filter (where x.status = 'confirmed' and coalesce(x.ends_at, x.starts_at) < now())::int as completed,
           count(*) filter (where x.status in ('confirmed', 'requested') and x.starts_at >= now())::int as upcoming
    from appointments x
    group by x.student_id
  )
  select p.id, p.first_name, p.last_name, p.email, p.student_code, p.is_active,
         p.created_at, p.last_active_on, coalesce(p.streak_days, 0),
         coalesce(t.done, 0), coalesce(q.mastered, 0),
         coalesce(q.rounds, 0), coalesce(q.questions, 0), coalesce(q.correct, 0),
         coalesce(q.xp_total, 0), coalesce(q.xp_week, 0), q.last_at,
         coalesce(p.driving_lessons_count, 0), coalesce(ap.completed, 0), coalesce(ap.upcoming, 0),
         p.drive_autobahn, p.drive_night, p.drive_overland,
         p.theory_exam_date, p.practical_exam_date, p.theory_passed, p.practical_passed
  from profiles p
  left join q  on q.sid  = p.id
  left join t  on t.sid  = p.id
  left join ap on ap.sid = p.id
  where p.role = 'student'
  order by p.last_name nulls last, p.first_name nulls last, p.email;
end $$;

revoke execute on function public.admin_student_performance() from public, anon;
grant execute on function public.admin_student_performance() to authenticated;

-- Per theory topic (1–14) for one student: rounds, accuracy, best round, mastered.
create or replace function public.admin_student_topic_stats(p_student uuid)
returns table (
  topic_number int,
  rounds       int,
  questions    int,
  correct      int,
  best_pct     int,
  mastered     boolean,
  last_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select a.topic_number::int,
         count(*)::int,
         sum(a.total)::int,
         sum(a.correct)::int,
         max(round(100.0 * a.correct / a.total))::int,
         bool_or(a.mastered),
         max(a.created_at)
  from quiz_attempts a
  where a.student_id = p_student
  group by a.topic_number
  order by a.topic_number;
end $$;

revoke execute on function public.admin_student_topic_stats(uuid) from public, anon;
grant execute on function public.admin_student_topic_stats(uuid) to authenticated;
