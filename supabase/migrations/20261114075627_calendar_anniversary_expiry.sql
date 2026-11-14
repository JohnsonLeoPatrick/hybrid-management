begin;
create or replace function public.membership_expiry(start_date date, months integer) returns date
language sql immutable set search_path=public as $$
 select anniversary + case when extract(day from anniversary) < extract(day from start_date) then 1 else 0 end
 from (select (start_date + make_interval(months=>months))::date as anniversary) dates
$$;
revoke all on function public.membership_expiry(date,integer) from public,anon;
grant execute on function public.membership_expiry(date,integer) to authenticated;

-- Preserve original dates for rollback. Correct only current rows matching the old extra-day formula.
create table private.calendar_anniversary_expiry_corrections as
select m.id,m.start,m.expiry as previous_expiry,public.membership_expiry(m.start,d.months) as corrected_expiry
from public.memberships m
cross join lateral (
 select (extract(year from (m.expiry-1))::int-extract(year from m.start)::int)*12
       +extract(month from (m.expiry-1))::int-extract(month from m.start)::int as months
) d
where not m.deleted and m.expiry >= (now() at time zone 'Asia/Kuala_Lumpur')::date
and d.months>0 and m.expiry=(m.start+make_interval(months=>d.months))::date+1
and public.membership_expiry(m.start,d.months)<m.expiry;
alter table private.calendar_anniversary_expiry_corrections enable row level security;
revoke all on private.calendar_anniversary_expiry_corrections from public,anon,authenticated;
alter table public.memberships disable trigger preserve_memberships;
update public.memberships m set expiry=c.corrected_expiry
from private.calendar_anniversary_expiry_corrections c where m.id=c.id;
alter table public.memberships enable trigger preserve_memberships;
commit;
