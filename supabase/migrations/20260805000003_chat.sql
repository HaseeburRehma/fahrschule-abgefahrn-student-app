-- ============================================================================
-- chat_messages — 1:1 messaging between a student and the school (admins).
-- Each conversation is keyed by student_id; `from_admin` marks the side.
-- ============================================================================

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  from_admin boolean not null,
  body       text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists idx_chat_student on public.chat_messages (student_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists chat_select on public.chat_messages;
create policy chat_select on public.chat_messages
  for select using (student_id = auth.uid() or public.is_admin());

-- Students send as themselves (from_admin=false); admins send from_admin=true.
drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert on public.chat_messages
  for insert with check (
    (sender_id = auth.uid() and from_admin = false and student_id = auth.uid())
    or (public.is_admin() and from_admin = true and sender_id = auth.uid())
  );

-- Mark-as-read (own conversation for students; any for admins).
drop policy if exists chat_update on public.chat_messages;
create policy chat_update on public.chat_messages
  for update using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

-- Ensure realtime is on for chat + notifications.
do $$
begin
  if not exists (select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public' and tablename='chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
  if not exists (select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
