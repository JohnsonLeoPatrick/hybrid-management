-- Apply after 003_qr_registration.sql. Public signup collects personal information only.
begin;
alter table public.registration_requests alter column "planId" drop not null;
create or replace function public.registration_options(branch_code text) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('branch',jsonb_build_object('id',b.id,'name',b.name,'code',b.code))
 from public.branches b where lower(b.code)=lower(branch_code) and b.active and not b.deleted
$$;
revoke all on function public.registration_options(text) from public;
grant execute on function public.registration_options(text) to anon,authenticated;

create or replace function public.submit_registration(branch_code text, details jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b public.branches; phone_key text; birth date; new_id uuid;
begin
 if octet_length(details::text)>8192 then raise exception 'Registration details are too large';end if;
 if coalesce((details->>'consent')::boolean,false) is not true then raise exception 'Consent is required';end if;
 if length(coalesce(details->>'company',''))>0 then return jsonb_build_object('received',true);end if;
 if length(trim(coalesce(details->>'name',''))) not between 2 and 120 then raise exception 'Enter your full name (2-120 characters)';end if;
 phone_key=regexp_replace(coalesce(details->>'phone',''),'[^0-9]','','g');
 if length(phone_key) not between 7 and 20 then raise exception 'Enter a valid phone number';end if;
 if length(coalesce(details->>'ic',''))>40 or length(coalesce(details->>'email',''))>254 or length(coalesce(details->>'address',''))>500 or length(coalesce(details->>'notes',''))>1000 or length(coalesce(details->>'emergencyName',''))>120 or length(coalesce(details->>'emergencyPhone',''))>30 or length(coalesce(details->>'gender',''))>30 then raise exception 'One or more fields are too long';end if;
 if coalesce(details->>'email','')<>'' and details->>'email' !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address';end if;
 if coalesce(details->>'dob','')<>'' then
 birth=(details->>'dob')::date;
 if birth>current_date or birth<date '1900-01-01' then raise exception 'Enter a valid date of birth';end if;
 end if;
 select * into b from public.branches where lower(code)=lower(branch_code) and active and not deleted;
 if not found then raise exception 'This branch is not accepting registrations';end if;
 -- Serialize submissions per branch so caps and duplicate checks remain atomic.
 perform pg_advisory_xact_lock(hashtextextended('qr-registration:'||b.id,0));
 -- The same phone cannot create repeated pending registrations. No existing details are returned.
 if exists(select 1 from public.registration_requests where "branchId"=b.id and "phoneKey"=phone_key and status='PENDING') then return jsonb_build_object('received',true);end if;
 if (select count(*) from public.registration_requests where "branchId"=b.id and "phoneKey"=phone_key and "checkedInAt">now()-interval '24 hours')>=3 then raise exception 'Please speak to reception to complete your registration';end if;
 if (select count(*) from public.registration_requests where "branchId"=b.id and "checkedInAt">now()-interval '1 hour')>=100 then raise exception 'Registration is busy. Please speak to reception';end if;
 insert into public.registration_requests("branchId",name,phone,"phoneKey",email,ic,dob,gender,address,"emergencyName","emergencyPhone",notes)
 values(b.id,trim(details->>'name'),trim(details->>'phone'),phone_key,lower(trim(coalesce(details->>'email',''))),trim(coalesce(details->>'ic','')),birth,coalesce(details->>'gender',''),coalesce(details->>'address',''),coalesce(details->>'emergencyName',''),coalesce(details->>'emergencyPhone',''),coalesce(details->>'notes','')) returning id into new_id;
 return jsonb_build_object('received',true);
end $$;
revoke all on function public.submit_registration(text,jsonb) from public;
grant execute on function public.submit_registration(text,jsonb) to anon,authenticated;

commit;
