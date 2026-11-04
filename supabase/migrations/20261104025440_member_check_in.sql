-- A null class ID records general gym attendance without inventing a class.
alter table public.attendance alter column "classId" drop not null;
create unique index attendance_gym_member_date_unique
 on public.attendance ("memberId", date) where "classId" is null;

-- Keep class enrollment enforcement separate from gym visits.
create function public.validate_attendance_visit() returns trigger
 language plpgsql set search_path = public as $$
begin
 if new."classId" is not null and not exists (
  select 1 from public.member_classes
  where "memberId" = new."memberId" and "classId" = new."classId"
 ) then
  raise exception 'Member must be enrolled in the class';
 end if;
 return new;
end;
$$;
revoke all on function public.validate_attendance_visit() from public;
drop trigger attendance_enrollment on public.attendance;
create trigger attendance_enrollment before insert or update on public.attendance
 for each row execute function public.validate_attendance_visit();

-- Existing RLS, grants, foreign keys, and class uniqueness remain in force.
