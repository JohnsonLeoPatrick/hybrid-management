begin;
-- Validate only new dates; existing historical records retain their original dates.
create function public.prevent_backdated_transaction() returns trigger
language plpgsql security invoker set search_path='' as $$
declare transaction_date date;
begin
 transaction_date=(to_jsonb(new)->>tg_argv[0])::date;
 if tg_op='UPDATE' and transaction_date is not distinct from (to_jsonb(old)->>tg_argv[0])::date then
  return new;
 end if;
 if transaction_date is null then raise exception 'Enter a valid %',lower(tg_argv[1]);end if;
 if transaction_date<(now() at time zone 'Asia/Kuala_Lumpur')::date then
  raise exception '% cannot be before today (Malaysia time).',tg_argv[1];
 end if;
 return new;
end;
$$;
revoke all on function public.prevent_backdated_transaction() from public,anon,authenticated;
create trigger prevent_membership_backdating before insert or update of start on public.memberships
 for each row execute function public.prevent_backdated_transaction('start','Start date');
create trigger prevent_payment_backdating before insert or update of date on public.payments
 for each row execute function public.prevent_backdated_transaction('date','Payment date');
commit;
