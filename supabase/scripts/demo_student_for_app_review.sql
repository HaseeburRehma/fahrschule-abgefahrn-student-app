-- Demo student for Apple App Review / store screenshots.
-- Run ONCE in the Supabase SQL editor (production project). Idempotent: re-running
-- refreshes the sample data but never creates a second account.
--
-- BEFORE RUNNING: replace the two values in the `params` block below.
--   • v_email     – an address you control (reviewers only need to sign in, no mail is sent)
--   • v_password  – a strong password, at least 8 characters with letters and digits
-- Then enter the same email/password in App Store Connect → App Review → Sign-in information.
-- Do not commit the filled-in password.

do $$
declare
  -- ── params ──────────────────────────────────────────────────────────────
  v_email    text := 'appreview@fahrschule-abgefahrn.de';
  v_password text := 'REPLACE-WITH-A-STRONG-PASSWORD';
  -- ────────────────────────────────────────────────────────────────────────
  v_uid  uuid;
  v_now  timestamptz := now();
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_topic6 uuid;
  v_admin uuid;
begin
  if v_password like 'REPLACE-%' or length(v_password) < 8 then
    raise exception 'Set v_password (min. 8 characters) before running this script.';
  end if;

  -- 1) auth user (email + password, already confirmed) ----------------------
  select id into v_uid from auth.users where lower(email) = lower(v_email);

  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      -- GoTrue expects '' (not NULL) in these token columns
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      lower(v_email), crypt(v_password, gen_salt('bf')),
      v_now, '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      v_now, v_now,
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      v_uid::text, v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', lower(v_email), 'email_verified', true),
      'email', v_now, v_now, v_now
    );
  else
    -- existing demo user: reset the password to the one above
    update auth.users
       set encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, v_now),
           updated_at = v_now
     where id = v_uid;
  end if;

  -- The SQL editor has no signed-in user, so is_admin() is false and the
  -- appointment triggers would treat these inserts as a student's (no past
  -- dates, no "confirmed", no instructor). Act as an existing admin for THIS
  -- transaction only — the same path the admin screens use.
  select id into v_admin from public.profiles
   where role = 'admin' and is_active
   order by created_at limit 1;
  if v_admin is null then
    raise exception 'No active admin profile found.';
  end if;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- 2) profile (row is created as role 'student' by the on_auth_user_created trigger)
  insert into public.profiles (id, email, role)
  values (v_uid, lower(v_email), 'student')
  on conflict (id) do nothing;

  select id into v_topic6 from public.theory_topics where number = 6;

  update public.profiles set
    first_name              = 'Demo',
    last_name               = 'Schüler',
    locale                  = 'de',
    license_class           = 'B',
    driving_lessons_count   = 8,
    drive_overland          = true,
    drive_autobahn          = false,
    drive_night             = false,
    theory_exam_date        = v_today + 21,
    current_theory_topic_id = v_topic6,
    streak_days             = 4,
    last_active_on          = v_today
  where id = v_uid;

  -- 3) theory: topics 1–5 done ----------------------------------------------
  delete from public.topic_progress where student_id = v_uid;
  insert into public.topic_progress (student_id, topic_id, done_at)
  select v_uid, t.id, v_now - ((6 - t.number) || ' days')::interval
  from public.theory_topics t
  where t.number between 1 and 5;

  -- 4) appointments: one upcoming (confirmed), one past ----------------------
  delete from public.appointments where student_id = v_uid;
  insert into public.appointments (student_id, title, starts_at, ends_at, status, instructor_name, meeting_point, lesson_type)
  values
    (v_uid, 'Fahrstunde mit Marco',
     ((v_today + 2)::text || ' 14:00 Europe/Berlin')::timestamptz,
     ((v_today + 2)::text || ' 15:30 Europe/Berlin')::timestamptz,
     'confirmed', 'Marco', 'Fahrschule Abgefahrn', 'regular'),
    (v_uid, 'Überlandfahrt',
     ((v_today - 5)::text || ' 10:00 Europe/Berlin')::timestamptz,
     ((v_today - 5)::text || ' 11:30 Europe/Berlin')::timestamptz,
     'confirmed', 'Marco', 'Fahrschule Abgefahrn', 'overland');

  -- 5) quiz history: a 4-day streak with mastered rounds ---------------------
  delete from public.quiz_attempts where student_id = v_uid;
  insert into public.quiz_attempts (student_id, topic_number, total, correct, xp, duration_ms, mastered, created_at)
  values
    (v_uid, 1, 10, 9, 90,  252000, true,  v_now - interval '3 days'),
    (v_uid, 2,  8, 8, 100, 198000, true,  v_now - interval '2 days'),
    (v_uid, 3, 10, 7, 70,  301000, false, v_now - interval '1 day'),
    (v_uid, 3, 10, 9, 90,  244000, true,  v_now - interval '20 hours'),
    (v_uid, 4, 10, 8, 80,  276000, true,  v_now - interval '2 hours');

  raise notice 'Demo student ready: % (id %)', lower(v_email), v_uid;
end $$;

-- Remove the demo student again (e.g. after the app is approved):
-- delete from auth.users where lower(email) = 'appreview@fahrschule-abgefahrn.de';
-- (profiles, topic_progress, appointments and quiz_attempts cascade)
