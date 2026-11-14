begin;
create function public.membership_expiry(start_date date, months integer) returns date
language sql immutable set search_path=public as $$
 select (start_date + make_interval(months=>months))::date + 1
$$;
revoke all on function public.membership_expiry(date,integer) from public,anon;
grant execute on function public.membership_expiry(date,integer) to authenticated;
do $$
declare signature text; definition text; updated text;
begin
 foreach signature in array array['public.approve_registration(uuid,text,date,numeric,text,text)','public.approve_registration_memberships(uuid,jsonb,text,text)'] loop
  definition=pg_get_functiondef(signature::regprocedure);
  updated=replace(replace(definition,'(start_date+make_interval(months=>p.months))::date','public.membership_expiry(start_date,p.months)'),'(start_date+make_interval(months=>months))::date','public.membership_expiry(start_date,months)');
  if updated=definition then raise exception 'Expiry expression not found in %',signature;end if;
  execute updated;
 end loop;
end $$;
-- Keep original dates for audit; completed historical memberships remain untouched.
create table private.membership_expiry_corrections as
select id,start,expiry as previous_expiry,expiry+1 as corrected_expiry from public.memberships
where not deleted and expiry >= (now() at time zone 'Asia/Kuala_Lumpur')::date
and (extract(year from expiry)::int*12+extract(month from expiry)::int)-(extract(year from start)::int*12+extract(month from start)::int)>0
and expiry=(start+make_interval(months=>(extract(year from expiry)::int*12+extract(month from expiry)::int)-(extract(year from start)::int*12+extract(month from start)::int)))::date;
alter table private.membership_expiry_corrections enable row level security;
revoke all on private.membership_expiry_corrections from public,anon,authenticated;
alter table public.memberships disable trigger preserve_memberships;
update public.memberships m set expiry=c.corrected_expiry from private.membership_expiry_corrections c where m.id=c.id;
alter table public.memberships enable trigger preserve_memberships;
commit;
