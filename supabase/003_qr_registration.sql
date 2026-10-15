-- Run once in the SQL Editor of the existing Hybrid project.
-- Public visitors can submit a request; they cannot read requests, members or payments.
begin;
create table public.registration_requests (
 id uuid primary key default gen_random_uuid(),
 "branchId" text not null references public.branches(id),
 "planId" text not null references public.membership_plans(id),
 name text not null, phone text not null, "phoneKey" text not null,
 email text not null default '', ic text not null default '', dob date,
 gender text not null default '', address text not null default '',
 "emergencyName" text not null default '', "emergencyPhone" text not null default '',
 notes text not null default '',
 "checkedInAt" timestamptz not null default now(),
 "consentedAt" timestamptz not null default now(),
 status text not null default 'PENDING' check(status in ('PENDING','APPROVED','DECLINED')),
 "memberId" text references public.members(id),
 "reviewedAt" timestamptz,
 "reviewedBy" uuid references auth.users(id)
);
create unique index one_pending_phone_per_branch on public.registration_requests("branchId","phoneKey") where status='PENDING';
create index registration_arrivals on public.registration_requests("branchId","checkedInAt" desc);
alter table public.registration_requests enable row level security;
revoke all on public.registration_requests from anon;
grant select,update on public.registration_requests to authenticated;
create policy staff_read_requests on public.registration_requests for select to authenticated using(public.staff_role() is not null);
create policy staff_review_requests on public.registration_requests for update to authenticated using(public.staff_role() is not null) with check(public.staff_role() is not null);

create function public.registration_options(branch_code text) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('branch',jsonb_build_object('id',b.id,'name',b.name,'code',b.code),
 'plans',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'price',p.price,'months',p.months,'description',p.description) order by p.name) from public.membership_plans p where p."branchId"=b.id and p.active and not p.deleted),'[]'::jsonb))
 from public.branches b where lower(b.code)=lower(branch_code) and b.active and not b.deleted
$$;
revoke all on function public.registration_options(text) from public;
grant execute on function public.registration_options(text) to anon,authenticated;

create function public.submit_registration(branch_code text, details jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b public.branches; chosen public.membership_plans; phone_key text; birth date; new_id uuid;
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
 select * into chosen from public.membership_plans where id=details->>'planId' and "branchId"=b.id and active and not deleted;
 if not found then raise exception 'Choose an available membership plan';end if;
 -- Serialize submissions per branch so caps and duplicate checks remain atomic.
 perform pg_advisory_xact_lock(hashtextextended('qr-registration:'||b.id,0));
 -- The same phone cannot create repeated pending registrations. No existing details are returned.
 if exists(select 1 from public.registration_requests where "branchId"=b.id and "phoneKey"=phone_key and status='PENDING') then return jsonb_build_object('received',true);end if;
 if (select count(*) from public.registration_requests where "branchId"=b.id and "phoneKey"=phone_key and "checkedInAt">now()-interval '24 hours')>=3 then raise exception 'Please speak to reception to complete your registration';end if;
 if (select count(*) from public.registration_requests where "branchId"=b.id and "checkedInAt">now()-interval '1 hour')>=100 then raise exception 'Registration is busy. Please speak to reception';end if;
 insert into public.registration_requests("branchId","planId",name,phone,"phoneKey",email,ic,dob,gender,address,"emergencyName","emergencyPhone",notes)
 values(b.id,chosen.id,trim(details->>'name'),trim(details->>'phone'),phone_key,lower(trim(coalesce(details->>'email',''))),trim(coalesce(details->>'ic','')),birth,coalesce(details->>'gender',''),coalesce(details->>'address',''),coalesce(details->>'emergencyName',''),coalesce(details->>'emergencyPhone',''),coalesce(details->>'notes','')) returning id into new_id;
 return jsonb_build_object('received',true);
end $$;
revoke all on function public.submit_registration(text,jsonb) from public;
grant execute on function public.submit_registration(text,jsonb) to anon,authenticated;

create function public.approve_registration(request_id uuid, selected_plan text, start_date date, amount_paid numeric default 0, payment_method text default 'Cash', payment_status text default 'Paid') returns text
language plpgsql security invoker set search_path=public as $$
declare r public.registration_requests; p public.membership_plans; b public.branches; member_id text; membership_id text; next_number integer;
begin
 if public.staff_role() is null then raise exception 'Staff access required';end if;
 if start_date is null or amount_paid is null or amount_paid<0 then raise exception 'Check the start date and payment amount';end if;
 if payment_method not in ('Cash','Online Transfer','Credit/Debit Card','E-Wallet','Other') or payment_status not in ('Paid','Pending','Partial','Overdue') then raise exception 'Invalid payment method or status';end if;
 perform pg_advisory_xact_lock(824312);
 select * into r from public.registration_requests where id=request_id for update;
 if not found then raise exception 'Registration was not found';end if;
 if r.status='APPROVED' then return r."memberId";end if;
 if r.status<>'PENDING' then raise exception 'Only pending requests can be approved';end if;
 select * into p from public.membership_plans where id=selected_plan and "branchId"=r."branchId" and active and not deleted;
 if not found then raise exception 'Select an active plan from the registration branch';end if;
 if exists(select 1 from public.members where (r.ic<>'' and lower(ic)=lower(r.ic)) or (r.email<>'' and lower(email)=lower(r.email)) or regexp_replace(phone,'[^0-9]','','g')=r."phoneKey") then raise exception 'A member with these details exists. Review the existing member instead';end if;
 select * into b from public.branches where id=r."branchId" and active and not deleted;
 if not found then raise exception 'This branch is inactive';end if;
 select coalesce(max(substring(id from '[0-9]+$')::integer),0)+1 into next_number from public.members where id like 'HYB-'||b.code||'-%';
 member_id='HYB-'||b.code||'-'||lpad(next_number::text,greatest(5,length(next_number::text)),'0');
 membership_id=gen_random_uuid()::text;
 insert into public.members(id,name,ic,dob,gender,phone,email,"emergencyName","emergencyPhone",address,registered,"branchId",photo,medical,notes,coach,"classIds")
 values(member_id,r.name,r.ic,r.dob,r.gender,r.phone,r.email,r."emergencyName",r."emergencyPhone",r.address,(now() at time zone 'Asia/Kuala_Lumpur')::date,r."branchId",'','',r.notes,'',p.classes);
 insert into public.memberships(id,"memberId","planId",start,expiry,state) values(membership_id,member_id,p.id,start_date,(start_date+make_interval(months=>p.months))::date,'NORMAL');
 if amount_paid>0 then insert into public.payments(id,"memberId","membershipId",amount,date,method,reference,notes,status)
 values(gen_random_uuid()::text,member_id,membership_id,amount_paid,(now() at time zone 'Asia/Kuala_Lumpur')::date,payment_method,'','QR registration',payment_status);end if;
 update public.registration_requests set status='APPROVED',"memberId"=member_id,"reviewedAt"=now(),"reviewedBy"=auth.uid() where id=r.id;
 return member_id;
end $$;
revoke all on function public.approve_registration(uuid,text,date,numeric,text,text) from public;
grant execute on function public.approve_registration(uuid,text,date,numeric,text,text) to authenticated;

create function public.decline_registration(request_id uuid) returns void
language plpgsql security invoker set search_path=public as $$ begin
 if public.staff_role() is null then raise exception 'Staff access required';end if;
 update public.registration_requests set status='DECLINED',"reviewedAt"=now(),"reviewedBy"=auth.uid() where id=request_id and status='PENDING';
 if not found then raise exception 'Pending registration was not found';end if;
end $$;
revoke all on function public.decline_registration(uuid) from public;
grant execute on function public.decline_registration(uuid) to authenticated;
grant usage on schema public to anon,authenticated;
commit;
