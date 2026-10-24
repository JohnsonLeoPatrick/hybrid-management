-- Bulk import is an unlocked-ledger operation; ordinary front-desk inserts remain available.
begin;
create function public.import_payments(entries jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare entry jsonb; p public.payments; imported integer=0;
begin
 if not public.payment_access() then raise exception 'Unlock Payments before importing';end if;
 if jsonb_typeof(entries) is distinct from 'array' then raise exception 'Expected payment rows';end if;
 if jsonb_array_length(entries) not between 1 and 5000 then raise exception 'Import between 1 and 5,000 payments';end if;
 perform pg_advisory_xact_lock(824312);
 for entry in select value from jsonb_array_elements(entries) loop
  p=jsonb_populate_record(null::public.payments,entry);
  p.id=coalesce(nullif(trim(p.id),''),gen_random_uuid()::text);
  p.deleted=false;p.reference=coalesce(p.reference,'');p.notes=coalesce(p.notes,'');
  if (entry->>'amount')::numeric is null or (entry->>'amount')::numeric::text in ('NaN','Infinity','-Infinity') or (entry->>'amount')::numeric<>round((entry->>'amount')::numeric,2) then raise exception 'Invalid payment amount at row %',imported+1;end if;
  if coalesce(entry->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Use YYYY-MM-DD dates at row %',imported+1;end if;
  if exists(select 1 from public.payments old where old.id=p.id or (not old.deleted and old."memberId"=p."memberId" and old."membershipId"=p."membershipId" and old.amount=p.amount and old.date=p.date and old.method=p.method and old.reference=p.reference)) then
   raise exception 'Duplicate payment at row %. Nothing was imported.',imported+1;
  end if;
  insert into public.payments select (p).*;
  imported=imported+1;
 end loop;
 return imported;
end;
$$;
revoke all on function public.import_payments(jsonb) from public,anon;
grant execute on function public.import_payments(jsonb) to authenticated;
commit;
