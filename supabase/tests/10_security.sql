-- ============================================================================
-- Database security tests (run by scripts/db-test.sh locally and in CI).
-- Each block acts as a real API role (anon / authenticated student / admin /
-- service_role) with Supabase-style JWT claims and raises 'FAIL: …' on a breach.
-- ============================================================================
\set ON_ERROR_STOP 1

-- ── fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('00000000-0000-0000-0000-000000000001', 's1@test.local'),
  ('00000000-0000-0000-0000-000000000002', 's2@test.local');
alter table public.profiles disable trigger trg_profiles_guard;
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
alter table public.profiles enable trigger trg_profiles_guard;
insert into public.quiz_attempts (student_id, topic_number, total, correct, xp, duration_ms, mastered) values
  ('00000000-0000-0000-0000-000000000001', 1, 10, 9, 90, 60000, true),
  ('00000000-0000-0000-0000-000000000002', 1, 10, 4, 40, 60000, false);

-- ── student s1 ──────────────────────────────────────────────────────────────
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
declare
  ok boolean;
  p public.profiles;
  before public.profiles;
  n int;
begin
  -- IDOR: another student's profile is invisible and not updatable
  select count(*) into n from public.profiles where id = '00000000-0000-0000-0000-000000000002';
  if n <> 0 then raise exception 'FAIL: student can read another profile'; end if;
  update public.profiles set first_name = 'pwned' where id = '00000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: student updated another profile'; end if;

  -- Mass assignment: privileged columns are silently kept, normal ones change
  select * into before from public.profiles where id = '00000000-0000-0000-0000-000000000001';
  update public.profiles set
    role = 'admin', is_active = false, email = 'victim@test.local', streak_days = 999,
    last_active_on = '2000-01-01', student_code = 'HACK-0001', license_class = 'A',
    created_at = '2000-01-01', first_name = 'Sam'
  where id = '00000000-0000-0000-0000-000000000001';
  select * into p from public.profiles where id = '00000000-0000-0000-0000-000000000001';
  if p.role <> 'student' or not p.is_active then raise exception 'FAIL: privilege escalation via role/is_active'; end if;
  if p.email is distinct from before.email then raise exception 'FAIL: student changed own e-mail'; end if;
  if p.streak_days is distinct from before.streak_days then raise exception 'FAIL: student faked streak'; end if;
  if p.student_code is distinct from before.student_code then raise exception 'FAIL: student changed own code'; end if;
  if p.license_class is distinct from before.license_class then raise exception 'FAIL: student changed licence class'; end if;
  if p.created_at is distinct from before.created_at then raise exception 'FAIL: student changed created_at'; end if;
  if p.first_name <> 'Sam' then raise exception 'FAIL: legitimate profile edit was blocked'; end if;

  -- the trusted path still works
  if public.touch_streak() <> 1 then raise exception 'FAIL: touch_streak broken'; end if;
  select streak_days into n from public.profiles where id = '00000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'FAIL: touch_streak did not persist'; end if;

  -- admin-only data stays hidden
  select count(*) into n from public.student_invites;  if n <> 0 then raise exception 'FAIL: student reads invites'; end if;
  select count(*) into n from public.student_imports;  if n <> 0 then raise exception 'FAIL: student reads imports'; end if;
  select count(*) into n from public.audit_log;        if n <> 0 then raise exception 'FAIL: student reads audit log'; end if;
  select count(*) into n from public.app_settings;     if n <> 0 then raise exception 'FAIL: student reads app settings (sign-up code)'; end if;
  select count(*) into n from public.feature_flags();  if n < 3 then raise exception 'FAIL: feature flags not readable'; end if;

  -- forbidden writes / calls
  ok := false; begin insert into public.student_invites (email, student_code) values ('evil@test.local', 'EVIL-0001'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: student inserted an invite'; end if;
  ok := false; begin insert into public.audit_log (action, table_name) values ('DELETE', 'x'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: student wrote the audit log'; end if;
  ok := false; begin insert into public.app_settings (key, value) values ('feature.invite_emails', 'off'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: student changed a feature flag'; end if;
  ok := false; begin perform * from public.admin_student_performance(); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: student called admin_student_performance'; end if;
  ok := false; begin perform * from public.admin_student_topic_stats('00000000-0000-0000-0000-000000000002'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: student read another student''s topic stats'; end if;
  ok := false; begin perform public.new_student_code(); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: student called new_student_code'; end if;
  ok := false; begin perform * from public.check_rate_limit('x', 1, 60); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: student called check_rate_limit'; end if;
  ok := false; begin insert into storage.objects (bucket_id, name) values ('student-imports', 'imports/x.csv'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: student uploaded into student-imports'; end if;
  raise notice 'student checks passed';
end $$;
rollback;

-- ── anonymous ───────────────────────────────────────────────────────────────
begin;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare ok boolean; n int;
begin
  select count(*) into n from public.profiles; if n <> 0 then raise exception 'FAIL: anon reads profiles'; end if;
  ok := false; begin perform * from public.admin_student_performance(); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: anon called admin RPC'; end if;
  select count(*) into n from public.feature_flags(); if n < 3 then raise exception 'FAIL: anon cannot read feature flags'; end if;
  raise notice 'anon checks passed';
end $$;
rollback;

-- ── admin ───────────────────────────────────────────────────────────────────
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$
declare ok boolean; n int; code text; a public.audit_log;
begin
  select count(*) into n from public.profiles; if n < 3 then raise exception 'FAIL: admin cannot see all profiles'; end if;
  select count(*) into n from public.admin_student_performance(); if n < 2 then raise exception 'FAIL: admin performance RPC'; end if;

  update public.profiles set student_code = 'k-2002' where id = '00000000-0000-0000-0000-000000000002';
  select student_code into code from public.profiles where id = '00000000-0000-0000-0000-000000000002';
  if code <> 'K-2002' then raise exception 'FAIL: code not normalised (%)', code; end if;
  select * into a from public.audit_log where table_name = 'profiles' and record_id = '00000000-0000-0000-0000-000000000002' order by id desc limit 1;
  if a.actor_id is distinct from '00000000-0000-0000-0000-00000000000a'::uuid or (a.changes -> 'student_code' ->> 'new') <> 'K-2002' then
    raise exception 'FAIL: audit log missing the admin code change';
  end if;

  ok := false; begin update public.profiles set student_code = 'AB''; DROP TABLE x' where id = '00000000-0000-0000-0000-000000000002'; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: malformed code accepted'; end if;

  ok := false; begin update public.profiles set role = 'student' where id = '00000000-0000-0000-0000-00000000000a'; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: last admin could be demoted'; end if;

  update public.app_settings set value = 'NEW-CODE-1' where key = 'signup_code';
  select * into a from public.audit_log where table_name = 'app_settings' order by id desc limit 1;
  if a.changes::text like '%NEW-CODE-1%' then raise exception 'FAIL: sign-up code written to the audit log in clear text'; end if;

  -- audit log is append-only even for admins
  ok := false; begin update public.audit_log set action = 'INSERT'; get diagnostics n = row_count; if n = 0 then ok := true; end if; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: admin rewrote audit history'; end if;
  ok := false; begin delete from public.audit_log; get diagnostics n = row_count; if n = 0 then ok := true; end if; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: admin deleted audit history'; end if;

  ok := false; begin update public.app_settings set value = 'maybe' where key = 'feature.invite_emails'; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: invalid feature flag value accepted'; end if;
  raise notice 'admin checks passed';
end $$;
rollback;

-- ── service role (edge functions) ───────────────────────────────────────────
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare ok boolean; r record; allowed boolean[] := '{}';
begin
  for i in 1..3 loop
    select * into r from public.check_rate_limit('test:ip:1.2.3.4', 2, 60);
    allowed := allowed || r.allowed;
  end loop;
  if allowed <> array[true, true, false] then raise exception 'FAIL: rate limit (%)', allowed; end if;
  if r.retry_after < 1 or r.retry_after > 60 then raise exception 'FAIL: retry_after %', r.retry_after; end if;

  insert into public.student_imports (file_name, file_format, total_rows, created_by, idempotency_key)
  values ('a.csv', 'csv', 1, '00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111');
  ok := false;
  begin
    insert into public.student_imports (file_name, file_format, total_rows, created_by, idempotency_key)
    values ('a.csv', 'csv', 1, '00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111');
  exception when unique_violation then ok := true; end;
  if not ok then raise exception 'FAIL: duplicate idempotency key accepted'; end if;

  ok := false; begin insert into public.student_invites (email, student_code) values ('not-an-email', 'GOOD-0002'); exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL: invalid invite e-mail accepted'; end if;

  ok := false; begin delete from public.audit_log; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: service role can delete audit history'; end if;
  raise notice 'service role checks passed';
end $$;
rollback;

\echo 'security tests passed'
