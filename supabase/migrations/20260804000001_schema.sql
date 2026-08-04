-- ============================================================================
-- Fahrschule Abgefahrn — core schema
-- ============================================================================
-- Run order: this file first, then _rls.sql, then _seed.sql.
-- Deploy with the Supabase CLI (`supabase db push`) or paste into the
-- SQL editor. Safe to re-run (guards with IF NOT EXISTS where possible).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('admin', 'student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_locale as enum ('de', 'en');
exception when duplicate_object then null; end $$;

do $$ begin
  create type intake_status as enum ('pending', 'converted', 'dismissed');
exception when duplicate_object then null; end $$;

-- ── updated_at helper ───────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── theory_topics (the 14 mandatory topics) ─────────────────────────────────
create table if not exists public.theory_topics (
  id       uuid primary key default gen_random_uuid(),
  number   int  not null unique,
  title_de text not null,
  title_en text not null
);

-- ── packages (service catalog) ──────────────────────────────────────────────
create table if not exists public.packages (
  id        uuid primary key default gen_random_uuid(),
  key       text not null unique,
  name_de   text not null,
  name_en   text not null,
  price_eur numeric(10,2) not null default 0,
  sort      int  not null default 0
);

-- ── profiles (one row per auth user) ────────────────────────────────────────
create table if not exists public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  email                    text,
  first_name               text,
  last_name                text,
  phone                    text,
  role                     user_role  not null default 'student',
  locale                   app_locale not null default 'de',
  is_active                boolean    not null default true,
  push_token               text,
  push_token_platform      text,
  push_token_updated_at    timestamptz,
  current_theory_topic_id  uuid references public.theory_topics(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── student_packages (which services a student holds) ───────────────────────
create table if not exists public.student_packages (
  student_id uuid not null references public.profiles(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, package_id)
);

-- ── theory_classes (scheduled appointments) ─────────────────────────────────
create table if not exists public.theory_classes (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid references public.theory_topics(id) on delete set null,
  title_de   text not null,
  title_en   text not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz,
  location   text,
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists idx_theory_classes_starts on public.theory_classes (starts_at);

-- ── class_enrollments (student ↔ class) ─────────────────────────────────────
create table if not exists public.class_enrollments (
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id   uuid not null references public.theory_classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, class_id)
);

-- ── notifications (in-app feed + push source) ───────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text,
  type       text not null default 'general',
  data       jsonb,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);

-- ── signup_intake (raw website submissions) ─────────────────────────────────
create table if not exists public.signup_intake (
  id            uuid primary key default gen_random_uuid(),
  first_name    text,
  last_name     text,
  email         text,
  phone         text,
  service_label text,
  payment       text,
  raw           jsonb,
  status        intake_status not null default 'pending',
  created_at    timestamptz not null default now()
);
create index if not exists idx_signup_intake_status on public.signup_intake (status, created_at desc);

-- ── auto-create a profile whenever an auth user is created ───────────────────
-- Admin provisions students via auth.admin.createUser; this trigger ensures a
-- matching profiles row always exists. Role/name are set afterwards by admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'student')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── is_admin() helper (SECURITY DEFINER → avoids RLS recursion) ──────────────
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- ── protect privileged columns from self-escalation ─────────────────────────
-- A student may edit their own first_name/last_name/phone/locale, but must not
-- change their role or is_active. Non-admin updates keep the OLD values.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_privileges();
