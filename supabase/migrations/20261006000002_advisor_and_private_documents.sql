-- 1) Supabase security advisor: trigger functions must not be callable via /rest/v1/rpc.
--    (Trigger execution does not need EXECUTE for the caller.)
do $$
declare f text;
begin
  foreach f in array array[
    'book_slot()', 'dispatch_push_on_notification()', 'guard_appointment_status()',
    'guard_chat_update()', 'guard_profile_privileges()', 'handle_new_user()',
    'notify_admins_cancelled_appointment()', 'notify_admins_new_appointment()', 'set_updated_at()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

alter function public.set_updated_at() set search_path = public;

-- is_admin() stays executable (RLS policies call it as the requesting role).

-- 2) Private per-student documents.
--    student_id NULL  → school-wide document (forms, Theorie-Lernheft …), visible to every student
--    student_id = uid → personal document (Ausbildungsvertrag, Sehtest …), visible to that student only
alter table public.documents add column if not exists student_id uuid references public.profiles(id) on delete cascade;
create index if not exists idx_documents_student on public.documents (student_id);

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select using (
    public.is_admin()
    or (auth.role() = 'authenticated' and (student_id is null or student_id = auth.uid()))
  );

-- Storage: personal files live under students/<uid>/…; everything else is school-wide.
drop policy if exists "docs read" on storage.objects;
create policy "docs read" on storage.objects
  for select using (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] is distinct from 'students'
      or (storage.foldername(name))[2] = auth.uid()::text
    )
  );
