begin;
alter table public.payments alter column "memberId" drop not null,alter column "membershipId" drop not null;
alter table public.payments add column "branchId" text references public.branches(id),add column items jsonb,add column "customerName" text not null default '',add column "customerEmail" text not null default '',add column "receiptNumber" text unique,add column "voidReason" text,add column "voidedAt" timestamptz,add column "voidedBy" uuid references auth.users(id);
alter table public.payments drop constraint payments_status_check;
alter table public.payments add constraint payments_status_check check(status in ('Paid','Pending','Partial','Overdue','Void'));
-- Backfill branch ownership without rewriting historical payment values.
alter table public.payments disable trigger preserve_payments;
update public.payments p set "branchId"=m."branchId" from public.members m where m.id=p."memberId";
alter table public.payments enable trigger preserve_payments;
alter table public.payments alter column "branchId" set not null;
create table private.receipt_counters(branch_id text primary key references public.branches(id),last_number bigint not null default 0);
alter table private.receipt_counters enable row level security;
revoke all on private.receipt_counters from public,anon,authenticated;

create function private.prepare_payment() returns trigger language plpgsql security definer set search_path='' as $$
declare branch text;seq bigint;prefix text;item jsonb;total numeric:=0;qty numeric;price numeric;
begin
 new."customerName":=coalesce(new."customerName",'');new."customerEmail":=coalesce(new."customerEmail",'');
 if auth.uid() is null or public.staff_role() is null then raise exception 'Staff access required';end if;
 if new."memberId" is not null then
  select m."branchId" into branch from public.members m join public.memberships ms on ms."memberId"=m.id where m.id=new."memberId" and ms.id=new."membershipId";
  if branch is null or new.items is not null then raise exception 'Invalid membership payment';end if;
  if new."branchId" is not null and new."branchId"<>branch then raise exception 'Payment branch mismatch';end if;
  new."branchId":=branch;
 else
  if new."membershipId" is not null or jsonb_typeof(new.items) is distinct from 'array' or jsonb_array_length(new.items) not between 1 and 20 then raise exception 'Enter 1 to 20 sale items';end if;
  for item in select value from jsonb_array_elements(new.items) loop
   qty:=(item->>'quantity')::numeric;price:=(item->>'unitPrice')::numeric;
   if length(trim(coalesce(item->>'description',''))) not between 1 and 160 or qty is null or qty<1 or qty>999 or qty<>trunc(qty) or price is null or price<=0 or price>999999 or price<>round(price,2) then raise exception 'Invalid sale item';end if;
   total:=total+qty*price;
  end loop;
  if new.amount<>total or new.status<>'Paid' then raise exception 'Sale total must match items and be paid';end if;
 end if;
 if new."branchId" is distinct from public.current_branch() then raise exception 'Unlock the payment branch';end if;
 if new.status='Void' or new.deleted or new."voidReason" is not null or new."voidedAt" is not null or new."voidedBy" is not null then raise exception 'Invalid new payment';end if;
 if length(new."customerName")>120 or length(new."customerEmail")>254 then raise exception 'Customer details too long';end if;
 insert into private.receipt_counters(branch_id,last_number) values(new."branchId",1) on conflict(branch_id) do update set last_number=private.receipt_counters.last_number+1 returning last_number into seq;
 select case when name ilike '%KIP%' then 'KIP' when name ilike '%BD%' then 'BD' else code end into prefix from public.branches where id=new."branchId";
 new."receiptNumber":=prefix||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0');
 return new;
end$$;
revoke all on function private.prepare_payment() from public,anon,authenticated;
drop trigger payment_member_link on public.payments;
create trigger prepare_payment before insert on public.payments for each row execute function private.prepare_payment();

create or replace function public.protect_payment_history() returns trigger language plpgsql set search_path='' as $$begin
 if (to_jsonb(new)-array['status','voidReason','voidedAt','voidedBy']) is distinct from (to_jsonb(old)-array['status','voidReason','voidedAt','voidedBy']) then raise exception 'Historical payment fields cannot be changed';end if;
 if old.status='Void' then raise exception 'Voided payments cannot be changed';end if;
 if new.status='Void' then
  if public.staff_role() not in ('ADMIN','SUPER ADMIN') or not public.payment_access() then raise exception 'Admin payment access required';end if;
  if length(trim(coalesce(new."voidReason",''))) not between 3 and 500 then raise exception 'Enter a void reason (3-500 characters)';end if;
  new."voidedAt":=now();new."voidedBy":=auth.uid();
 elsif new."voidReason" is distinct from old."voidReason" or new."voidedAt" is distinct from old."voidedAt" or new."voidedBy" is distinct from old."voidedBy" then raise exception 'Void audit fields cannot be changed';
 end if;return new;
end$$;
create function public.prevent_payment_delete() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Payments cannot be deleted. Void an incorrect payment instead.';end$$;
revoke all on function public.prevent_payment_delete() from public,anon,authenticated;
create trigger no_payment_delete before delete on public.payments for each row execute function public.prevent_payment_delete();
drop policy branch_unlock_required on public.payments;
create policy branch_unlock_required on public.payments as restrictive for all to authenticated using("branchId"=(select public.current_branch())) with check("branchId"=(select public.current_branch()));
create function public.void_payment(payment_id text,reason text) returns void language plpgsql security invoker set search_path='' as $$begin
 update public.payments set status='Void',"voidReason"=reason where id=payment_id;
 if not found then raise exception 'Payment unavailable. Refresh and try again.';end if;
end$$;
revoke all on function public.void_payment(text,text) from public,anon;
grant execute on function public.void_payment(text,text) to authenticated;
commit;
