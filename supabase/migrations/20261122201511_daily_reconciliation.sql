begin;
create index if not exists payments_branch_day on public.payments("branchId",date);
create index if not exists memberships_start_member on public.memberships(start,"memberId");
alter table public.payments drop constraint payments_status_check;
alter table public.payments add constraint payments_status_check check(status in ('Paid','Partial','Pending','Overdue','Void','Refunded'));
-- Reuse existing reversal audit fields rather than storing receipt copies or duplicate ledger entries.
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.protect_payment_history()'::regprocedure);
 definition:=replace(definition,'old.status=''Void''','old.status in (''Void'',''Refunded'')');
 definition:=replace(definition,'new.status=''Void''','new.status in (''Void'',''Refunded'')');
 definition:=replace(definition,'if new.status in (''Void'',''Refunded'') then','if new.status in (''Void'',''Refunded'') then if new.status=''Refunded'' and old.status not in (''Paid'',''Partial'') then raise exception ''Only collected payments can be refunded'';end if;');
 if position('old.status in (''Void'',''Refunded'')' in definition)=0 then raise exception 'Unexpected payment history function';end if;
 execute definition;
 definition:=pg_get_functiondef('private.prepare_payment()'::regprocedure);
 definition:=replace(definition,'new.status=''Void''','new.status in (''Void'',''Refunded'')');
 if position('new.status in (''Void'',''Refunded'')' in definition)=0 then raise exception 'Unexpected payment preparation function';end if;execute definition;
end$$;
create function public.record_full_refund(payment_id text,reason text) returns void language plpgsql security invoker set search_path='' as $$begin
 update public.payments set status='Refunded',"voidReason"=reason where id=payment_id and status in ('Paid','Partial');
 if not found then raise exception 'Only a collected payment can be refunded';end if;
end$$;
revoke all on function public.record_full_refund(text,text) from public,anon;
grant execute on function public.record_full_refund(text,text) to authenticated;
-- Requests are small audit records. Daily reports and PDF files are never stored.
create table public.payment_requests(
 id uuid primary key default gen_random_uuid(),payment_id text not null references public.payments(id),
 kind text not null check(kind in ('void','refund')),reason text not null check(length(trim(reason)) between 3 and 500),
 requested_by uuid not null default auth.uid() references auth.users(id),requested_at timestamptz not null default now(),
 status text not null default 'Pending' check(status in ('Pending','Resolved','Declined')),
 reviewed_by uuid references auth.users(id),reviewed_at timestamptz
);
create unique index payment_one_pending_request on public.payment_requests(payment_id) where status='Pending';
alter table public.payment_requests enable row level security;
revoke all on public.payment_requests from public,anon,authenticated;
grant select,insert,update on public.payment_requests to authenticated;
create policy request_read on public.payment_requests for select to authenticated using(exists(select 1 from public.payments p where p.id=payment_id) and (requested_by=auth.uid() or public.staff_role() in ('ADMIN','SUPER ADMIN')));
create policy request_create on public.payment_requests for insert to authenticated with check(requested_by=auth.uid() and status='Pending' and reviewed_by is null and reviewed_at is null and exists(select 1 from public.payments p where p.id=payment_id and p.status in ('Paid','Partial','Pending','Overdue')));
create policy request_review on public.payment_requests for update to authenticated using(public.staff_role() in ('ADMIN','SUPER ADMIN') and exists(select 1 from public.payments p where p.id=payment_id)) with check(public.staff_role() in ('ADMIN','SUPER ADMIN'));
create function public.guard_payment_request() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='INSERT' then new.requested_at:=now();
 else
  if old.status<>'Pending' or new.status not in ('Resolved','Declined') or (to_jsonb(new)-array['status','reviewed_by','reviewed_at']) is distinct from (to_jsonb(old)-array['status','reviewed_by','reviewed_at']) then raise exception 'Request audit cannot be changed';end if;
  new.reviewed_by:=auth.uid();new.reviewed_at:=now();
 end if;return new;end$$;
revoke all on function public.guard_payment_request() from public,anon,authenticated;
create trigger guard_payment_request before insert or update on public.payment_requests for each row execute function public.guard_payment_request();
create function private.resolve_payment_requests() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status in ('Void','Refunded') and new.status is distinct from old.status then update public.payment_requests set status='Resolved' where payment_id=new.id and status='Pending';end if;return new;end$$;
revoke all on function private.resolve_payment_requests() from public,anon,authenticated;
create trigger resolve_payment_requests after update on public.payments for each row execute function private.resolve_payment_requests();
create policy staff_payment_updates_admin_only on public.payments as restrictive for update to authenticated using(public.staff_role() in ('ADMIN','SUPER ADMIN')) with check(public.staff_role() in ('ADMIN','SUPER ADMIN'));

create function private.daily_reconciliation(report_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare branch text;manager boolean;result jsonb;
begin
 branch:=public.current_branch();manager:=coalesce(public.staff_role() in ('ADMIN','SUPER ADMIN'),false);
 if auth.uid() is null or public.staff_role() is null or branch is null or not public.payment_access() then raise exception 'Unlock branch and Payments first';end if;
 if report_date is null or report_date>(now() at time zone 'Asia/Kuala_Lumpur')::date then raise exception 'Choose today or an earlier date';end if;
 if not manager and report_date<>(now() at time zone 'Asia/Kuala_Lumpur')::date then raise exception 'Staff may view today only';end if;
 select jsonb_build_object('date',report_date,'branch',branch,'manager',manager,
 'receipts',count(*),'collected',coalesce(sum(amount) filter(where status in ('Paid','Partial')),0),
 'cash',coalesce(sum(amount) filter(where status in ('Paid','Partial') and method='Cash'),0),
 'bank',coalesce(sum(amount) filter(where status in ('Paid','Partial') and method in ('QR','Online Transfer')),0),
 'card',coalesce(sum(amount) filter(where status in ('Paid','Partial') and method='Credit/Debit Card'),0),
 'other',coalesce(sum(amount) filter(where status in ('Paid','Partial') and method not in ('Cash','QR','Online Transfer','Credit/Debit Card')),0),
 'unpaid',count(*) filter(where status in ('Pending','Overdue')),
 'voided',coalesce(jsonb_agg(jsonb_build_object('receipt',"receiptNumber",'status',status,'amount',amount,'reason',"voidReason",'at',"voidedAt")) filter(where status in ('Void','Refunded')),'[]'::jsonb)) into result
 from public.payments where "branchId"=branch and date=report_date and not deleted;
 if manager then
  result:=result||jsonb_build_object(
   'missing_receipt_count',greatest(0,coalesce((select last_number from private.receipt_counters where branch_id=branch),0)-(select count(*) from public.payments where "branchId"=branch and "receiptNumber" is not null)),
   'number_gaps',coalesce((select jsonb_agg(gap) from (select previous+1 as first,current-1 as last from (select coalesce(lag(n) over(order by n),0) as previous,n as current from (select substring("receiptNumber" from '-([0-9]+)$')::bigint n from public.payments where "branchId"=branch and "receiptNumber" is not null union all select last_number+1 from private.receipt_counters where branch_id=branch) numbered) gaps where current>previous+1 limit 100) gap),'[]'::jsonb),
   'memberships_without_collection',coalesce((select jsonb_agg(row) from (select ms.id,m.name,ms.start from public.memberships ms join public.members m on m.id=ms."memberId" where m."branchId"=branch and ms.start=report_date and not ms.deleted and not exists(select 1 from public.payments p where p."membershipId"=ms.id and p.status in ('Paid','Partial') and not p.deleted) limit 100) row),'[]'::jsonb),
   'requests',coalesce((select jsonb_agg(row) from (select r.id,r.kind,r.reason,r.requested_at,p."receiptNumber" as receipt,p.amount from public.payment_requests r join public.payments p on p.id=r.payment_id where p."branchId"=branch and r.status='Pending' order by r.requested_at limit 100) row),'[]'::jsonb));
 end if;
 return result;
end$$;
revoke all on function private.daily_reconciliation(date) from public,anon,authenticated;
grant execute on function private.daily_reconciliation(date) to authenticated;
create function public.daily_reconciliation(report_date date) returns jsonb language sql stable security invoker set search_path='' as $$select private.daily_reconciliation(report_date)$$;
revoke all on function public.daily_reconciliation(date) from public,anon;
grant execute on function public.daily_reconciliation(date) to authenticated;
commit;
