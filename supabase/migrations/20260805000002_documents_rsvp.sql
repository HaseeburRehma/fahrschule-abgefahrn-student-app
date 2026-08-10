-- ============================================================================
-- documents (PDF sharing) + class_rsvp (attendance). Documents live in a
-- private Storage bucket; admins upload, any authenticated user downloads via
-- signed URL. RSVP lets a student say whether they'll attend a class.
-- ============================================================================

-- ── documents metadata ──────────────────────────────────────────────────────
create table if not exists public.documents (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  path       text not null,
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select using (auth.role() = 'authenticated');
drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents
  for all using (public.is_admin()) with check (public.is_admin());

-- ── storage bucket + object policies ────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "docs read" on storage.objects;
create policy "docs read" on storage.objects
  for select using (bucket_id = 'documents' and auth.role() = 'authenticated');
drop policy if exists "docs admin insert" on storage.objects;
create policy "docs admin insert" on storage.objects
  for insert with check (bucket_id = 'documents' and public.is_admin());
drop policy if exists "docs admin update" on storage.objects;
create policy "docs admin update" on storage.objects
  for update using (bucket_id = 'documents' and public.is_admin());
drop policy if exists "docs admin delete" on storage.objects;
create policy "docs admin delete" on storage.objects
  for delete using (bucket_id = 'documents' and public.is_admin());

-- ── class_rsvp (attendance) ─────────────────────────────────────────────────
create table if not exists public.class_rsvp (
  student_id   uuid not null references public.profiles(id) on delete cascade,
  class_id     uuid not null references public.theory_classes(id) on delete cascade,
  attending    boolean not null,
  responded_at timestamptz not null default now(),
  primary key (student_id, class_id)
);
alter table public.class_rsvp enable row level security;

drop policy if exists rsvp_select on public.class_rsvp;
create policy rsvp_select on public.class_rsvp
  for select using (student_id = auth.uid() or public.is_admin());
drop policy if exists rsvp_write on public.class_rsvp;
create policy rsvp_write on public.class_rsvp
  for all using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());
