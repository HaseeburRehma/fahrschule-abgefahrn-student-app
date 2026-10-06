-- Typography: German closing quote “ in appointment notification texts („Fahrstunde“).

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
           coalesce(sname, 'Ein Fahrschüler') || ' hat „' || new.title || '“ am '
             || to_char(new.starts_at at time zone 'Europe/Berlin', 'DD.MM.YYYY "um" HH24:MI') || ' abgesagt.',
           'schedule',
           jsonb_build_object('type', 'schedule', 'appointment_id', new.id)
    from public.profiles p
    where p.role = 'admin' and p.is_active;
  end if;
  return new;
end $$;

create or replace function public.notify_admins_new_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare sname text;
begin
  if public.is_admin() then
    return new;  -- the school created it itself; the student is notified instead
  end if;
  select coalesce(nullif(trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), ''), email)
    into sname from public.profiles where id = new.student_id;
  insert into public.notifications (user_id, title, body, type, data)
  select p.id,
         case when new.status = 'confirmed' then 'Neue Terminbuchung' else 'Neue Terminanfrage' end,
         coalesce(sname, 'Ein Fahrschüler') || ' hat „' || new.title || '“ am '
           || to_char(new.starts_at at time zone 'Europe/Berlin', 'DD.MM.YYYY "um" HH24:MI')
           || case when new.status = 'confirmed' then ' gebucht.' else ' angefragt.' end,
         'schedule',
         jsonb_build_object('type', 'schedule', 'appointment_id', new.id)
  from public.profiles p
  where p.role = 'admin' and p.is_active;
  return new;
end $$;

create or replace function public.notify_student_appointment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ttl text; bdy text;
  whn text := to_char(new.starts_at at time zone 'Europe/Berlin', 'DD.MM.YYYY "um" HH24:MI');
begin
  if not public.is_admin() then
    return new;  -- only changes made by the school are announced to the student
  end if;
  if tg_op = 'INSERT' then
    if new.status = 'cancelled' then return new; end if;
    ttl := 'Neuer Termin';
    bdy := '„' || new.title || '“ am ' || whn || ' wurde für dich eingetragen.';
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    ttl := 'Termin abgesagt';
    bdy := 'Dein Termin „' || new.title || '“ am '
           || to_char(old.starts_at at time zone 'Europe/Berlin', 'DD.MM.YYYY "um" HH24:MI') || ' wurde abgesagt.';
  elsif new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    ttl := 'Termin bestätigt';
    bdy := 'Dein Termin „' || new.title || '“ am ' || whn || ' ist bestätigt.';
  elsif new.status <> 'cancelled' and (new.starts_at is distinct from old.starts_at
         or new.meeting_point is distinct from old.meeting_point
         or new.instructor_name is distinct from old.instructor_name) then
    ttl := 'Termin geändert';
    bdy := 'Dein Termin „' || new.title || '“ ist jetzt am ' || whn
           || coalesce(' · Treffpunkt: ' || nullif(new.meeting_point, ''), '') || '.';
  else
    return new;
  end if;
  insert into public.notifications (user_id, title, body, type, data)
  values (new.student_id, ttl, bdy, 'schedule', jsonb_build_object('type', 'schedule', 'appointment_id', new.id));
  return new;
end $$;

