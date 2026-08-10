-- ============================================================================
-- topic_progress — lets a student mark which of the 14 theory topics they've
-- completed. Students read/write only their own rows; admins can see all.
-- ============================================================================

create table if not exists public.topic_progress (
  student_id uuid not null references public.profiles(id) on delete cascade,
  topic_id   uuid not null references public.theory_topics(id) on delete cascade,
  done_at    timestamptz not null default now(),
  primary key (student_id, topic_id)
);

alter table public.topic_progress enable row level security;

drop policy if exists topic_progress_select on public.topic_progress;
create policy topic_progress_select on public.topic_progress
  for select using (student_id = auth.uid() or public.is_admin());

drop policy if exists topic_progress_write on public.topic_progress;
create policy topic_progress_write on public.topic_progress
  for all using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());
