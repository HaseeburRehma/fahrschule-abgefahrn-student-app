-- One admin dashboard load = the performance RPC over all students.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select count(*) from public.admin_student_performance();
commit;
