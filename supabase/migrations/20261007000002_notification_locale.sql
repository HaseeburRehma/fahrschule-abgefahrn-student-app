-- Student-facing appointment notifications in the student's language (profiles.locale,
-- kept in sync by the app). German stays the default.

create or replace function public.notify_student_appointment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  en boolean := coalesce((select locale::text from public.profiles where id = new.student_id), 'de') = 'en';
  ttl text; bdy text;
  ttl_title text := case when en and new.title = 'Fahrstunde' then 'Driving lesson' else new.title end;
  whn text := case when en
    then to_char(new.starts_at at time zone 'Europe/Berlin', 'DD Mon YYYY "at" HH24:MI')
    else to_char(new.starts_at at time zone 'Europe/Berlin', 'DD.MM.YYYY "um" HH24:MI') end;
  old_whn text := case when tg_op = 'UPDATE' then
    case when en
      then to_char(old.starts_at at time zone 'Europe/Berlin', 'DD Mon YYYY "at" HH24:MI')
      else to_char(old.starts_at at time zone 'Europe/Berlin', 'DD.MM.YYYY "um" HH24:MI') end
    else null end;
begin
  if not public.is_admin() then
    return new;  -- only changes made by the school are announced to the student
  end if;
  if tg_op = 'INSERT' then
    if new.status = 'cancelled' then return new; end if;
    if en then ttl := 'New appointment'; bdy := '“' || ttl_title || '” on ' || whn || ' has been booked for you.';
    else ttl := 'Neuer Termin'; bdy := '„' || ttl_title || '“ am ' || whn || ' wurde für dich eingetragen.'; end if;
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    if en then ttl := 'Appointment cancelled'; bdy := 'Your appointment “' || ttl_title || '” on ' || old_whn || ' has been cancelled.';
    else ttl := 'Termin abgesagt'; bdy := 'Dein Termin „' || ttl_title || '“ am ' || old_whn || ' wurde abgesagt.'; end if;
  elsif new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    if en then ttl := 'Appointment confirmed'; bdy := 'Your appointment “' || ttl_title || '” on ' || whn || ' is confirmed.';
    else ttl := 'Termin bestätigt'; bdy := 'Dein Termin „' || ttl_title || '“ am ' || whn || ' ist bestätigt.'; end if;
  elsif new.status <> 'cancelled' and (new.starts_at is distinct from old.starts_at
         or new.meeting_point is distinct from old.meeting_point
         or new.instructor_name is distinct from old.instructor_name) then
    if en then ttl := 'Appointment changed';
      bdy := 'Your appointment “' || ttl_title || '” is now on ' || whn || coalesce(' · Meeting point: ' || nullif(new.meeting_point, ''), '') || '.';
    else ttl := 'Termin geändert';
      bdy := 'Dein Termin „' || ttl_title || '“ ist jetzt am ' || whn || coalesce(' · Treffpunkt: ' || nullif(new.meeting_point, ''), '') || '.'; end if;
  else
    return new;
  end if;
  insert into public.notifications (user_id, title, body, type, data)
  values (new.student_id, ttl, bdy, 'schedule', jsonb_build_object('type', 'schedule', 'appointment_id', new.id));
  return new;
end $$;

revoke execute on function public.notify_student_appointment_change() from public, anon, authenticated;
