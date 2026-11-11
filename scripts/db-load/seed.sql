-- Synthetic load data: 2,000 students with 50 quiz rounds each (100k rows).
alter table public.profiles disable trigger trg_profiles_guard;
insert into auth.users (id, email)
select gen_random_uuid(), 'load' || g || '@test.local' from generate_series(1, 2000) g;
alter table public.profiles enable trigger trg_profiles_guard;
insert into public.quiz_attempts (student_id, topic_number, total, correct, xp, duration_ms, mastered, created_at)
select p.id, 1 + (g % 14), 10, (random() * 10)::int, (random() * 120)::int, 60000, random() > 0.7, now() - (random() * interval '60 days')
from public.profiles p cross join generate_series(1, 50) g
where p.email like 'load%@test.local';
analyze;
