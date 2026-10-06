-- Admin management from the app (Administration → Anmeldecode & Admins).
-- Admins may promote students / demote other admins (RLS + guard already allow admins
-- to change role/is_active). Safeguard: the school can never lose its last active admin.

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
    return new;
  end if;
  -- admin is changing someone: never remove/deactivate the last active admin
  if old.role = 'admin' and old.is_active and (new.role <> 'admin' or not new.is_active) then
    if not exists (
      select 1 from public.profiles
      where role = 'admin' and is_active and id <> old.id
    ) then
      raise exception 'last_admin' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create or replace function public.guard_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin' and old.is_active and not exists (
    select 1 from public.profiles where role = 'admin' and is_active and id <> old.id
  ) then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  return old;
end $$;

drop trigger if exists trg_profiles_delete_guard on public.profiles;
create trigger trg_profiles_delete_guard
  before delete on public.profiles
  for each row execute function public.guard_profile_delete();

revoke execute on function public.guard_profile_delete() from public, anon, authenticated;
revoke execute on function public.guard_profile_privileges() from public, anon, authenticated;
