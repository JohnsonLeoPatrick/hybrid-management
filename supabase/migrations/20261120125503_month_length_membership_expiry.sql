begin;

-- Count days in consecutive calendar months from the start month; carry excess days forward instead of clamping.
create or replace function public.membership_expiry(start_date date, months integer) returns date
language sql immutable set search_path=public as $$
 select (date_trunc('month',start_date::timestamp) + make_interval(months=>months))::date
        + extract(day from start_date)::integer - 1
$$;
revoke all on function public.membership_expiry(date,integer) from public,anon;
grant execute on function public.membership_expiry(date,integer) to authenticated;

-- Stored memberships retain their recorded expiry dates and history protection.
commit;
