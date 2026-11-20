begin;
-- Keep legacy labels valid so existing ledger records and exports retain their original meaning.
alter table public.payments drop constraint payments_method_check;
alter table public.payments add constraint payments_method_check
 check(method in ('Cash','QR','Online Transfer','Credit/Debit Card','E-Wallet','Other'));

do $$
declare signature text; definition text; updated text;
begin
 foreach signature in array array[
  'public.approve_registration(uuid,text,date,numeric,text,text)',
  'public.approve_registration_memberships(uuid,jsonb,text,text)'
 ] loop
  definition=pg_get_functiondef(signature::regprocedure);
  updated=replace(definition,
   '(''Cash'',''Online Transfer'',''Credit/Debit Card'',''E-Wallet'',''Other'')',
   '(''Cash'',''QR'',''Online Transfer'',''Credit/Debit Card'',''E-Wallet'',''Other'')');
  if updated=definition then raise exception 'Payment method validation not found in %',signature;end if;
  execute updated;
 end loop;
end $$;
commit;
