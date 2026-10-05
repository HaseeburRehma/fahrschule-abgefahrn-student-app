-- Figma redesign (v2): extra fields shown by the new student app screens,
-- plus the school sign-up code used by the `signup-with-code` edge function.

-- appointments: lesson details (Termin Detail)
alter table public.appointments add column if not exists instructor_name text;
alter table public.appointments add column if not exists meeting_point  text;
alter table public.appointments add column if not exists lesson_type    text; -- regular | autobahn | night | overland | exam_prep

-- theory_topics: detail page content (Theorie Detail)
alter table public.theory_topics add column if not exists description_de  text;
alter table public.theory_topics add column if not exists description_en  text;
alter table public.theory_topics add column if not exists learn_points_de text[];
alter table public.theory_topics add column if not exists learn_points_en text[];
alter table public.theory_topics add column if not exists duration_min    int default 90;

-- profiles: profile header / streak
alter table public.profiles add column if not exists license_class  text default 'B';
alter table public.profiles add column if not exists birth_date     date;
alter table public.profiles add column if not exists streak_days    int  not null default 0;
alter table public.profiles add column if not exists last_active_on date;

-- Students may update their own birth_date / license_class through the existing
-- profiles_update_self policy (no change needed).

-- Daily streak: called by the app once per day on open.
create or replace function public.touch_streak()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  today date := (now() at time zone 'Europe/Berlin')::date;
  s int;
begin
  select streak_days, last_active_on into p from profiles where id = auth.uid();
  if not found then return 0; end if;
  if p.last_active_on = today then
    return p.streak_days;
  elsif p.last_active_on = today - 1 then
    s := coalesce(p.streak_days, 0) + 1;
  else
    s := 1;
  end if;
  update profiles set streak_days = s, last_active_on = today where id = auth.uid();
  return s;
end;
$$;
grant execute on function public.touch_streak() to authenticated;

-- School sign-up code (only readable by service role / admins).
create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.app_settings (key, value)
values ('signup_code', 'ABG-2026')
on conflict (key) do nothing;
