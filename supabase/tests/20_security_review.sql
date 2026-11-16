-- ============================================================================
-- Tests for 20261116000001_security_review.sql (runs after 10_security.sql,
-- whose fixtures — admin, s1, s2 — are already committed).
-- ============================================================================
\set ON_ERROR_STOP 1

-- ── fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000003', 's3@test.local');
insert into public.theory_classes (id, title_de, title_en, starts_at)
  values ('00000000-0000-0000-0000-0000000000c1', 'Klasse', 'Class', now() + interval '2 days');
insert into public.class_enrollments (student_id, class_id)
  values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1');
insert into public.appointments (id, student_id, starts_at)
  values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000003', now() + interval '3 days');
insert into public.notifications (id, user_id, title, body)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001', 'Original', 'Body');
-- earlier fixture rounds are old, so the "too fast" check starts clean
update public.quiz_attempts set created_at = now() - interval '1 hour';
-- s3 is deactivated by the school
alter table public.profiles disable trigger trg_profiles_guard;
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-000000000003';
alter table public.profiles enable trigger trg_profiles_guard;

-- ── deactivated student s3 ──────────────────────────────────────────────────
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
declare
  n int;
  ok boolean;
begin
  select count(*) into n from public.profiles where id = '00000000-0000-0000-0000-000000000003';
  if n <> 1 then raise exception 'FAIL: deactivated user cannot read own profile (app needs it to sign out)'; end if;

  select count(*) into n from public.appointments;
  if n <> 0 then raise exception 'FAIL: deactivated student still reads appointments'; end if;
  select count(*) into n from public.theory_topics;
  if n <> 0 then raise exception 'FAIL: deactivated student still reads theory topics'; end if;

  ok := false;
  begin
    insert into public.appointments (student_id, starts_at) values ('00000000-0000-0000-0000-000000000003', now() + interval '5 days');
  exception when insufficient_privilege or check_violation then ok := true;
  end;
  if not ok then raise exception 'FAIL: deactivated student can still book'; end if;

  ok := false;
  begin
    insert into public.chat_messages (student_id, sender_id, from_admin, body)
      values ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', false, 'hi');
  exception when insufficient_privilege or check_violation then ok := true;
  end;
  if not ok then raise exception 'FAIL: deactivated student can still chat'; end if;

  ok := false;
  begin perform * from public.record_quiz_attempt(1, 10, 10, 60000);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'FAIL: deactivated student can still post quiz results'; end if;

  select count(*) into n from public.quiz_league();
  if n <> 0 then raise exception 'FAIL: deactivated student still sees the league'; end if;
  raise notice 'deactivated-account checks passed';
end $$;
rollback;

-- ── active student s1 ───────────────────────────────────────────────────────
insert into public.theory_classes (id, title_de, title_en, starts_at)
  values ('00000000-0000-0000-0000-0000000000c2', 'Andere', 'Other', now() + interval '4 days');

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare
  n int;
  ok boolean;
  nt public.notifications;
begin
  insert into public.class_rsvp (student_id, class_id, attending)
    values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', true);

  ok := false;
  begin
    insert into public.class_rsvp (student_id, class_id, attending)
      values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2', true);
  exception when insufficient_privilege or check_violation then ok := true;
  end;
  if not ok then raise exception 'FAIL: RSVP to a class the student is not enrolled in'; end if;

  -- notifications: only is_read may change
  update public.notifications set title = 'pwned', body = 'pwned', data = '{"route":"/x"}', is_read = true
    where id = '00000000-0000-0000-0000-0000000000f1';
  select * into nt from public.notifications where id = '00000000-0000-0000-0000-0000000000f1';
  if nt.title <> 'Original' or nt.body <> 'Body' or nt.data is not null then
    raise exception 'FAIL: student rewrote a notification';
  end if;
  if not nt.is_read then raise exception 'FAIL: student cannot mark a notification read'; end if;

  -- quiz: a second round right after the first is refused (server clock)
  perform * from public.record_quiz_attempt(2, 10, 10, 1);
  ok := false;
  begin perform * from public.record_quiz_attempt(2, 10, 10, 1);
  exception when program_limit_exceeded then ok := true;
  end;
  if not ok then raise exception 'FAIL: quiz rounds accepted back to back'; end if;
  raise notice 'active-student checks passed';
end $$;
rollback;

\echo 'security review tests passed'
