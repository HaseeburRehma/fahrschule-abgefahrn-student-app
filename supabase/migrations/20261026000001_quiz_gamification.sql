-- Theorie-Quiz & gamification (Figma "09 · Spielerisch & Maskottchen" / "11 · Mehr Spielerisch").
--
-- quiz_attempts holds one row per finished quiz round. Clients never insert
-- directly: record_quiz_attempt() validates the numbers and computes XP on the
-- server, so the weekly league can't be pumped by hand-crafted inserts.

create table if not exists public.quiz_attempts (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles (id) on delete cascade,
  topic_number smallint not null check (topic_number between 1 and 14),
  total        smallint not null check (total between 1 and 15),
  correct      smallint not null check (correct between 0 and 15 and correct <= total),
  xp           int not null check (xp between 0 and 200),
  duration_ms  int not null check (duration_ms between 0 and 7200000),
  mastered     boolean not null,
  created_at   timestamptz not null default now()
);

create index if not exists quiz_attempts_student_created_idx
  on public.quiz_attempts (student_id, created_at desc);
create index if not exists quiz_attempts_created_idx
  on public.quiz_attempts (created_at);

alter table public.quiz_attempts enable row level security;

drop policy if exists quiz_attempts_select_own on public.quiz_attempts;
create policy quiz_attempts_select_own on public.quiz_attempts
  for select using (student_id = auth.uid() or public.is_admin());

drop policy if exists quiz_attempts_admin_all on public.quiz_attempts;
create policy quiz_attempts_admin_all on public.quiz_attempts
  for all using (public.is_admin()) with check (public.is_admin());

-- No insert/update/delete policy for students: writes go through the RPC below.

-- ── record_quiz_attempt ───────────────────────────────────────────────────────
-- XP: 10 per correct answer, +20 bonus for a perfect round. A round counts as
-- "mastered" at ≥ 80 % correct. Also bumps the daily streak.
create or replace function public.record_quiz_attempt(
  p_topic int,
  p_total int,
  p_correct int,
  p_duration_ms int
)
returns table (xp int, mastered boolean, streak_days int)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  v_xp int;
  v_mastered boolean;
  v_today_count int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_topic not between 1 and 14
     or p_total not between 1 and 15
     or p_correct not between 0 and p_total
     or p_duration_ms not between 0 and 7200000 then
    raise exception 'invalid quiz result' using errcode = '22023';
  end if;

  -- Rate limit: at most 40 rounds per (Berlin) day per student.
  select count(*) into v_today_count
  from quiz_attempts
  where student_id = uid
    and created_at >= date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin';
  if v_today_count >= 40 then
    raise exception 'daily quiz limit reached' using errcode = '54000';
  end if;

  v_mastered := p_correct * 5 >= p_total * 4;
  v_xp := p_correct * 10 + case when p_correct = p_total then 20 else 0 end;

  insert into quiz_attempts (student_id, topic_number, total, correct, xp, duration_ms, mastered)
  values (uid, p_topic, p_total, p_correct, v_xp, p_duration_ms, v_mastered);

  return query select v_xp, v_mastered, public.touch_streak();
end $$;

revoke execute on function public.record_quiz_attempt(int, int, int, int) from public, anon;
grant execute on function public.record_quiz_attempt(int, int, int, int) to authenticated;

-- ── quiz_league ───────────────────────────────────────────────────────────────
-- Weekly league (Monday 00:00 Europe/Berlin → Sunday). Returns the top 20 plus
-- the caller. Only a first name and last-name initial are exposed.
create or replace function public.quiz_league()
returns table (rank int, display_name text, initial text, xp int, is_me boolean)
language sql
security definer
stable
set search_path = public
as $$
  with week_start as (
    select date_trunc('week', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin' as ts
  ),
  totals as (
    select p.id,
           coalesce(nullif(trim(p.first_name), ''), 'Fahrschüler') as first_name,
           nullif(left(trim(coalesce(p.last_name, '')), 1), '') as last_initial,
           coalesce(sum(a.xp), 0)::int as xp
    from profiles p
    left join quiz_attempts a
      on a.student_id = p.id and a.created_at >= (select ts from week_start)
    where p.role = 'student' and p.is_active
    group by p.id
  ),
  ranked as (
    select id, first_name, last_initial, xp,
           (row_number() over (order by xp desc, first_name, id))::int as rank
    from totals
    -- students who haven't played this week stay out of everyone else's list
    where xp > 0 or id = auth.uid()
  )
  select r.rank,
         r.first_name || coalesce(' ' || r.last_initial || '.', '') as display_name,
         upper(left(r.first_name, 1)) as initial,
         r.xp,
         r.id = auth.uid() as is_me
  from ranked r
  where auth.uid() is not null
    and (r.rank <= 20 or r.id = auth.uid())
  order by r.rank;
$$;

revoke execute on function public.quiz_league() from public, anon;
grant execute on function public.quiz_league() to authenticated;
