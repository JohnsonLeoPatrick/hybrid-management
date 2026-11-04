-- Validate original numeric inputs before numeric(12,2) columns can round them.
-- Existing stored amounts, policies, grants, and payment history are unchanged.
do $migration$
declare definition text; marker text; replacement text;
begin
 definition=pg_get_functiondef('public.apply_changes(jsonb,jsonb)'::regprocedure);
 marker='payload=jsonb_build_object(''deleted'',false)||(change->''data'');';
 replacement=marker||$guard$
 if tbl='payments' then
  if payload->>'amount' is null or (payload->>'amount')::numeric::text in ('NaN','Infinity','-Infinity')
   or (payload->>'amount')::numeric<=0 or (payload->>'amount')::numeric>9999999999.99
   or (payload->>'amount')::numeric<>round((payload->>'amount')::numeric,2)
  then raise exception 'Payment amount must be positive with at most 2 decimal places';end if;
 elsif tbl='membership_plans' then
  if payload->>'price' is null or (payload->>'price')::numeric::text in ('NaN','Infinity','-Infinity')
   or (payload->>'price')::numeric<0 or (payload->>'price')::numeric>9999999999.99
   or (payload->>'price')::numeric<>round((payload->>'price')::numeric,2)
  then raise exception 'Plan price must have at most 2 decimal places';end if;
 end if;
$guard$;
 if position(marker in definition)=0 then raise exception 'Unexpected apply_changes definition';end if;
 execute replace(definition,marker,replacement);

 definition=pg_get_functiondef('public.approve_registration_memberships(uuid,jsonb,text,text)'::regprocedure);
 marker='membership_id=gen_random_uuid()::text;';
 replacement=$guard$
 if amount_paid<>round(amount_paid,2) or amount_paid>9999999999.99
 then raise exception 'Payment amount must have at most 2 decimal places';end if;
 $guard$||marker;
 if position(marker in definition)=0 then raise exception 'Unexpected approval definition';end if;
 execute replace(definition,marker,replacement);

 definition=pg_get_functiondef('public.approve_registration(uuid,text,date,numeric,text,text)'::regprocedure);
 marker='if start_date is null or amount_paid is null';
 replacement=$guard$
 if amount_paid::text in ('NaN','Infinity','-Infinity') or amount_paid<>round(amount_paid,2) or amount_paid>9999999999.99
 then raise exception 'Payment amount must have at most 2 decimal places';end if;
 $guard$||marker;
 if position(marker in definition)=0 then raise exception 'Unexpected legacy approval definition';end if;
 execute replace(definition,marker,replacement);
end;
$migration$;
