-- ============================================================================
-- Row Level Security — students see only their own data; admins see all.
-- The intake + push edge functions use the service-role key, which BYPASSES
-- RLS entirely, so no public insert policies are needed for those paths.
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.packages          enable row level security;
alter table public.student_packages  enable row level security;
alter table public.theory_topics     enable row level security;
alter table public.theory_classes    enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.notifications     enable row level security;
alter table public.signup_intake     enable row level security;

-- Helper to (re)create a policy idempotently.
-- (Postgres has no CREATE POLICY IF NOT EXISTS, so drop-then-create.)

-- ── profiles ────────────────────────────────────────────────────────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
  for insert with check (public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete using (public.is_admin());

-- ── packages (read-all, admin-write) ────────────────────────────────────────
drop policy if exists packages_select on public.packages;
create policy packages_select on public.packages
  for select using (auth.role() = 'authenticated');

drop policy if exists packages_write on public.packages;
create policy packages_write on public.packages
  for all using (public.is_admin()) with check (public.is_admin());

-- ── theory_topics (read-all, admin-write) ───────────────────────────────────
drop policy if exists topics_select on public.theory_topics;
create policy topics_select on public.theory_topics
  for select using (auth.role() = 'authenticated');

drop policy if exists topics_write on public.theory_topics;
create policy topics_write on public.theory_topics
  for all using (public.is_admin()) with check (public.is_admin());

-- ── theory_classes (read-all, admin-write) ──────────────────────────────────
drop policy if exists classes_select on public.theory_classes;
create policy classes_select on public.theory_classes
  for select using (auth.role() = 'authenticated');

drop policy if exists classes_write on public.theory_classes;
create policy classes_write on public.theory_classes
  for all using (public.is_admin()) with check (public.is_admin());

-- ── student_packages (own or admin; admin-write) ────────────────────────────
drop policy if exists student_packages_select on public.student_packages;
create policy student_packages_select on public.student_packages
  for select using (student_id = auth.uid() or public.is_admin());

drop policy if exists student_packages_write on public.student_packages;
create policy student_packages_write on public.student_packages
  for all using (public.is_admin()) with check (public.is_admin());

-- ── class_enrollments (own or admin; admin-write) ───────────────────────────
drop policy if exists enrollments_select on public.class_enrollments;
create policy enrollments_select on public.class_enrollments
  for select using (student_id = auth.uid() or public.is_admin());

drop policy if exists enrollments_write on public.class_enrollments;
create policy enrollments_write on public.class_enrollments
  for all using (public.is_admin()) with check (public.is_admin());

-- ── notifications ───────────────────────────────────────────────────────────
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());

-- Students may flip is_read on their own rows; admins may do anything.
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_insert_admin on public.notifications;
create policy notifications_insert_admin on public.notifications
  for insert with check (public.is_admin());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete using (user_id = auth.uid() or public.is_admin());

-- ── signup_intake (admin-only; edge fn writes via service role) ─────────────
drop policy if exists intake_select_admin on public.signup_intake;
create policy intake_select_admin on public.signup_intake
  for select using (public.is_admin());

drop policy if exists intake_write_admin on public.signup_intake;
create policy intake_write_admin on public.signup_intake
  for all using (public.is_admin()) with check (public.is_admin());
