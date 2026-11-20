begin;

-- Each purchased month starts at the previous expiry and adds that date's calendar month length.
create or replace function public.membership_expiry(start_date date, months integer) returns date
language plpgsql immutable strict set search_path=public as $$
declare
 expiry date := start_date;
 month_start date;
 month_index integer;
begin
 for month_index in 1..months loop
  month_start := date_trunc('month',expiry::timestamp)::date;
  expiry := expiry + ((month_start + interval '1 month')::date - month_start);
 end loop;
 return expiry;
end;
$$;
revoke all on function public.membership_expiry(date,integer) from public,anon;
grant execute on function public.membership_expiry(date,integer) to authenticated;

-- Stored memberships retain their recorded expiry dates and history protection.
commit;
