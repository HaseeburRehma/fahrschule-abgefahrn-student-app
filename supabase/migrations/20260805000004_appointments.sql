-- ============================================================================
-- appointments — student-booked 1:1 lessons (e.g. driving lesson Mon 12–14:00).
-- A student creates their own (status 'requested'); an admin confirms/cancels.
-- Distinct from theory_classes (admin-run group sessions).
-- ============================================================================

create table if not exists public.appointments (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title      text not null default 'Fahrstunde',
  starts_at  timestamptz not null,
  ends_at    timestamptz,
  note       text,
  status     text not null default 'requested', -- requested | confirmed | cancelled
  created_at timestamptz not null default now()
);
create index if not exists idx_appointments_student on public.appointments (student_id, starts_at);

alter table public.appointments enable row level security;

drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments
  for select using (student_id = auth.uid() or public.is_admin());

drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments
  for insert with check (student_id = auth.uid() or public.is_admin());

drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments
  for update using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

drop policy if exists appointments_delete on public.appointments;
create policy appointments_delete on public.appointments
  for delete using (student_id = auth.uid() or public.is_admin());

-- Only an admin may set 'confirmed'; a student may only keep it requested or cancel.
create or replace function public.guard_appointment_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and new.status not in ('requested', 'cancelled') then
    new.status := old.status;
  end if;
  return new;
end $$;

drop trigger if exists trg_appt_guard on public.appointments;
create trigger trg_appt_guard before update on public.appointments
  for each row execute function public.guard_appointment_status();
