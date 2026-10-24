-- Apply after 006_payment_security.sql. Front-desk collection does not unlock the ledger.
begin;
drop policy payment_unlock_required on public.payments;
create policy payment_read_unlock_required on public.payments as restrictive for select to authenticated
 using (public.payment_access());
create policy payment_update_unlock_required on public.payments as restrictive for update to authenticated
 using (public.payment_access()) with check (public.payment_access());
create policy payment_delete_unlock_required on public.payments as restrictive for delete to authenticated
 using (public.payment_access());
-- The existing staff_insert policy still requires an authorized staff account.
commit;
