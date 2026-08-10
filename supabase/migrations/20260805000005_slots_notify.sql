-- ============================================================================
-- availability_slots — admin-defined open time slots students can grab.
-- Booking a slot creates an appointment that references it, auto-confirmed and
-- capacity-checked by a trigger. Also: notify all admins on every new booking.
-- ============================================================================

create table if not exists public.availability_slots (
  id         uuid primary key default gen_random_uuid(),
  starts_at  timestamptz not null,
  ends_at    timestamptz,
  capacity   int not null default 1,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists idx_slots_starts on public.availability_slots (starts_at);

alter table public.availability_slots enable row level security;
drop policy if exists slots_select on public.availability_slots;
create policy slots_select on public.availability_slots
  for select using (auth.role() = 'authenticated');
drop policy if exists slots_write on public.availability_slots;
create policy slots_write on public.availability_slots
  for all using (public.is_admin()) with check (public.is_admin());

-- Link appointments to a slot (free-form bookings keep slot_id null).
alter table public.appointments
  add column if not exists slot_id uuid references public.availability_slots(id) on delete set null;

-- Booking rules: a slot booking is capacity-checked, takes the slot's time, and
-- is auto-confirmed. A free-form booking by a student stays 'requested'.
create or replace function public.book_slot()
returns trigger language plpgsql security definer set search_path = public as $$
declare s public.availability_slots; cnt int;
begin
  if new.slot_id is not null then
    select * into s from public.availability_slots where id = new.slot_id;
    if s.id is null then raise exception 'slot_not_found'; end if;
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
  end if;
  return new;
end $$;

drop trigger if exists trg_book_slot on public.appointments;
create trigger trg_book_slot before insert on public.appointments
  for each row execute function public.book_slot();

-- Notify every active admin when a student books.
create or replace function public.notify_admins_new_appointment()
returns trigger language plpgsql security definer set search_path = public as $$
declare sname text;
begin
  select coalesce(nullif(trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), ''), email)
    into sname from public.profiles where id = new.student_id;
  insert into public.notifications (user_id, title, body, type, data)
  select p.id,
         'Neue Terminbuchung',
         coalesce(sname, 'Ein Fahrschüler') || ' hat „' || new.title || '" gebucht.',
         'schedule',
         jsonb_build_object('type', 'schedule', 'appointment_id', new.id)
  from public.profiles p
  where p.role = 'admin' and p.is_active;
  return new;
end $$;

drop trigger if exists trg_notify_admins_appt on public.appointments;
create trigger trg_notify_admins_appt after insert on public.appointments
  for each row execute function public.notify_admins_new_appointment();
