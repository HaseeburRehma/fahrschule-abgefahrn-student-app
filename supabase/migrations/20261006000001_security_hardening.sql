-- Security hardening (2026-10-06), found by the RLS test suite run as a real student:
--   T03 students could set instructor/meeting point on their own bookings
--   T04 students could move / edit a CONFIRMED lesson (time, instructor, …)
--   T06 students could hard-delete a confirmed lesson without the school noticing
--   T08 students could rewrite the school's chat messages in their thread
--   push-dispatch accepted unauthenticated payloads (anyone could push to any device)
-- plus defence-in-depth: new auth users are always students, touch_streak not callable by anon,
-- cancellations by students notify the admins, document bucket limits.

-- ── appointments: students may only request, cancel, or edit their note ────────
create or replace function public.guard_appointment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  -- Students: everything is locked except cancelling and the free-text note.
  new.id              := old.id;
  new.student_id      := old.student_id;
  new.title           := old.title;
  new.starts_at       := old.starts_at;
  new.ends_at         := old.ends_at;
  new.slot_id         := old.slot_id;
  new.created_at      := old.created_at;
  new.instructor_name := old.instructor_name;
  new.meeting_point   := old.meeting_point;
  new.lesson_type     := old.lesson_type;
  if new.status is distinct from old.status and new.status <> 'cancelled' then
    new.status := old.status;
  end if;
  return new;
end $$;

create or replace function public.book_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare s public.availability_slots; cnt int;
begin
  if not public.is_admin() then
    -- instructor / meeting point are assigned by the school only
    new.instructor_name := null;
    new.meeting_point := null;
    if new.title is null or length(trim(new.title)) = 0 then new.title := 'Fahrstunde'; end if;
    new.title := left(new.title, 80);
    new.note := left(new.note, 1000);
    if new.status = 'cancelled' then new.status := 'requested'; end if;
  end if;
  if new.slot_id is not null then
    select * into s from public.availability_slots where id = new.slot_id;
    if s.id is null then raise exception 'slot_not_found'; end if;
    perform 1 from public.availability_slots where id = new.slot_id for update; -- serialise concurrent bookings
    select count(*) into cnt from public.appointments
      where slot_id = new.slot_id and status <> 'cancelled';
    if cnt >= s.capacity then raise exception 'slot_full'; end if;
    new.starts_at := s.starts_at;
    new.ends_at := s.ends_at;
    new.status := 'confirmed';
  else
    if not public.is_admin() and new.status = 'confirmed' then
      new.status := 'requested';
    end if;
    if not public.is_admin() and new.starts_at < now() - interval '5 minutes' then
      raise exception 'starts_in_past';
    end if;
  end if;
  return new;
end $$;

-- Students may delete only their own not-confirmed entries (confirmed lessons must be cancelled).
drop policy if exists appointments_delete on public.appointments;
create policy appointments_delete on public.appointments
  for delete using (public.is_admin() or (student_id = auth.uid() and status <> 'confirmed'));

-- Tell the school when a student cancels.
create or replace function public.notify_admins_cancelled_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare sname text;
begin
  if old.status is distinct from 'cancelled' and new.status = 'cancelled' and not public.is_admin() then
    select coalesce(nullif(trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), ''), email)
      into sname from public.profiles where id = new.student_id;
    insert into public.notifications (user_id, title, body, type, data)
    select p.id,
           'Termin abgesagt',
           coalesce(sname, 'Ein Fahrschüler') || ' hat „' || new.title || '" am '
             || to_char(new.starts_at at time zone 'Europe/Berlin', 'DD.MM.YYYY "um" HH24:MI') || ' abgesagt.',
           'schedule',
           jsonb_build_object('type', 'schedule', 'appointment_id', new.id)
    from public.profiles p
    where p.role = 'admin' and p.is_active;
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_admins_appt_cancel on public.appointments;
create trigger trg_notify_admins_appt_cancel
  after update of status on public.appointments
  for each row execute function public.notify_admins_cancelled_appointment();

-- ── chat: students may only mark the school's messages as read ─────────────────
create or replace function public.guard_chat_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  new.id         := old.id;
  new.student_id := old.student_id;
  new.sender_id  := old.sender_id;
  new.from_admin := old.from_admin;
  new.body       := old.body;
  new.created_at := old.created_at;
  if not old.from_admin then
    new.read_at := old.read_at;  -- only the recipient (school) marks student messages read
  end if;
  return new;
end $$;

drop trigger if exists trg_chat_guard on public.chat_messages;
create trigger trg_chat_guard
  before update on public.chat_messages
  for each row execute function public.guard_chat_update();

-- Length limit on chat messages (defence against huge payloads).
alter table public.chat_messages drop constraint if exists chat_body_len;
alter table public.chat_messages add constraint chat_body_len check (char_length(body) between 1 and 4000) not valid;

-- ── new auth users are always students (admins are promoted explicitly) ────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'student')
  on conflict (id) do nothing;
  return new;
end $$;

-- ── function privileges ────────────────────────────────────────────────────────
revoke execute on function public.touch_streak() from public, anon;
grant execute on function public.touch_streak() to authenticated;

-- ── documents bucket: size + type limits ───────────────────────────────────────
update storage.buckets
   set file_size_limit = 26214400, -- 25 MB
       allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/heic','image/webp']
 where id = 'documents';

-- ── push-dispatch: authenticate the DB → edge function call ────────────────────
-- The shared secret lives in Supabase Vault ('push_webhook_secret', created out of band)
-- and is sent as x-webhook-secret; the function rejects calls without it.
create or replace function public.dispatch_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1;
  perform net.http_post(
    url := 'https://fzolxwxdeyshtodlikkl.supabase.co/functions/v1/push-dispatch',
    body := jsonb_build_object('type','INSERT','table','notifications','schema','public','record', jsonb_build_object('id', new.id)),
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret', coalesce(secret, ''))
  );
  return new;
end $$;
