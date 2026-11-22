begin;
-- Historical arrival times are unknown. Only new check-ins receive a timestamp.
alter table public.attendance add column "checkedInAt" timestamptz;
create function public.stamp_attendance() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='INSERT' then new."checkedInAt":=clock_timestamp();
 elsif new."checkedInAt" is distinct from old."checkedInAt" then raise exception 'Check-in timestamps cannot be changed';
 end if;return new;
end$$;
revoke all on function public.stamp_attendance() from public,anon,authenticated;
create trigger stamp_attendance before insert or update on public.attendance for each row execute function public.stamp_attendance();
commit;
