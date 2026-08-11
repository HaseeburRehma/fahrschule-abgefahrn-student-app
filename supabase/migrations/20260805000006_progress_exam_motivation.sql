-- ============================================================================
-- Progress tracker extras + exam dates (student-owned state) + motivation pool.
-- ============================================================================

-- Student self-tracked progress + exam dates (self-updatable; guard trigger
-- already blocks role/is_active changes, these columns are free to edit).
alter table public.profiles
  add column if not exists driving_lessons_count int not null default 0,
  add column if not exists drive_autobahn  boolean not null default false,
  add column if not exists drive_night      boolean not null default false,
  add column if not exists drive_overland   boolean not null default false,
  add column if not exists theory_exam_date    date,
  add column if not exists practical_exam_date date,
  add column if not exists theory_passed    boolean,
  add column if not exists practical_passed boolean;

-- Admin-editable motivation message pool (shown as daily pushes before exams).
create table if not exists public.motivation_messages (
  id         uuid primary key default gen_random_uuid(),
  body_de    text not null,
  body_en    text not null,
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.motivation_messages enable row level security;
drop policy if exists motivation_select on public.motivation_messages;
create policy motivation_select on public.motivation_messages
  for select using (auth.role() = 'authenticated');
drop policy if exists motivation_write on public.motivation_messages;
create policy motivation_write on public.motivation_messages
  for all using (public.is_admin()) with check (public.is_admin());

-- Seed a starter pool (the school can edit/replace these in the admin panel).
insert into public.motivation_messages (body_de, body_en, sort)
select * from (values
  ('Heute ein Thema, morgen der Führerschein. Bleib dran! 🚗', 'One topic today, your license tomorrow. Keep going! 🚗', 1),
  ('Jede Theoriestunde bringt dich näher ans Ziel.', 'Every theory session gets you closer to the goal.', 2),
  ('Vorfahrt für deinen Traum – du schaffst das!', 'Right of way for your dream — you''ve got this!', 3),
  ('5 Minuten lernen heute ist besser als 0. Los geht''s!', '5 minutes of studying today beats 0. Let''s go!', 4),
  ('Bald sitzt du am Steuer. Heute ist ein guter Lerntag. 💪', 'Soon you''ll be behind the wheel. Today is a good day to study. 💪', 5),
  ('Ruhig bleiben, gut vorbereiten – der Rest kommt von allein.', 'Stay calm, prepare well — the rest follows.', 6),
  ('Der Löwe in dir gibt nicht auf. 🦁', 'The lion in you doesn''t give up. 🦁', 7),
  ('Kleine Schritte, großes Ziel. Weiter so!', 'Small steps, big goal. Keep it up!', 8)
) as v(body_de, body_en, sort)
where not exists (select 1 from public.motivation_messages);
