-- ============================================================================
-- Security review fixes (2026-11-16)
--
-- 1. Deactivated accounts lose data access immediately. Until now `is_active`
--    was only checked by the app on start-up; the database never looked at it,
--    so a deactivated student kept reading / booking / chatting with an open
--    session. Restrictive policies are ANDed with the existing ones, so every
--    table now also requires an active account (admins: is_admin() is already
--    active-only). A deactivated user can still read their own profile row, so
--    the app can show "account deactivated" and sign out.
-- 2. RSVP only for classes the student is enrolled in.
-- 3. Students may only mark their own notifications read (no rewriting of
--    title / body / data).
-- 4. Quiz results: active accounts only, and at most one round per
--    (2 s × questions) — a script can no longer post 40 perfect rounds at once.
-- 5. League: only for active accounts.
-- Idempotent: safe to run again.
-- ============================================================================

-- ── 1. active accounts only ─────────────────────────────────────────────────
create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_active from profiles where id = auth.uid()), false)
$$;
revoke execute on function public.is_active_member() from public, anon;
grant execute on function public.is_active_member() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'appointments', 'availability_slots', 'chat_messages', 'class_enrollments', 'class_rsvp',
    'documents', 'motivation_messages', 'notifications', 'packages', 'quiz_attempts',
    'student_packages', 'theory_classes', 'theory_topics', 'topic_progress'
  ] loop
    execute format('drop policy if exists active_only on public.%I', t);
    execute format(
      'create policy active_only on public.%I as restrictive for all to authenticated '
      || 'using ((select public.is_active_member())) with check ((select public.is_active_member()))',
      t
    );
  end loop;
end $$;

-- profiles: a deactivated user still sees (only) their own row
drop policy if exists active_only on public.profiles;
create policy active_only on public.profiles as restrictive for select to authenticated
  using (id = auth.uid() or (select public.is_active_member()));

-- storage: documents bucket needs an active account too
drop policy if exists "docs active only" on storage.objects;
create policy "docs active only" on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'documents' or (select public.is_active_member()));

-- ── 2. RSVP only for enrolled classes ───────────────────────────────────────
drop policy if exists rsvp_write on public.class_rsvp;
create policy rsvp_write on public.class_rsvp
  for all using (student_id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (
      student_id = auth.uid()
      and exists (
        select 1 from public.class_enrollments e
        where e.class_id = class_rsvp.class_id and e.student_id = auth.uid()
      )
    )
  );

-- ── 3. notifications: students may only change read_at ──────────────────────
create or replace function public.guard_notification_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' or auth.uid() is null then
    return new;
  end if;
  -- everything except read_at stays as it was
  new.user_id := old.user_id;
  new.title := old.title;
  new.body := old.body;
  new.type := old.type;
  new.data := old.data;
  new.created_at := old.created_at;
  return new;
end $$;
revoke execute on function public.guard_notification_update() from public, anon, authenticated;

drop trigger if exists trg_notifications_guard on public.notifications;
create trigger trg_notifications_guard
  before update on public.notifications
  for each row execute function public.guard_notification_update();

-- ── 4. quiz results ─────────────────────────────────────────────────────────
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
  v_last timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_active_member() then
    raise exception 'account inactive' using errcode = '42501';
  end if;
  if p_topic not between 1 and 14
     or p_total not between 1 and 15
     or p_correct not between 0 and p_total
     or p_duration_ms not between 0 and 7200000 then
    raise exception 'invalid quiz result' using errcode = '22023';
  end if;

  -- One round needs real time: at least 2 s per question since the last round
  -- (measured by the server clock, not the duration the app reports).
  select max(created_at) into v_last from quiz_attempts where student_id = uid;
  if v_last is not null and now() - v_last < make_interval(secs => 2 * p_total) then
    raise exception 'quiz rounds too fast' using errcode = '54000';
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

-- ── 5. league: active accounts only ─────────────────────────────────────────
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
  where public.is_active_member()
    and (r.rank <= 20 or r.id = auth.uid())
  order by r.rank;
$$;

revoke execute on function public.quiz_league() from public, anon;
grant execute on function public.quiz_league() to authenticated;
