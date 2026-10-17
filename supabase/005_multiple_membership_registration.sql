-- Apply after 004. Staff approve all selected memberships in one transaction.
begin;
create or replace function public.approve_registration_memberships(request_id uuid, selected_memberships jsonb, payment_method text default 'Cash', payment_status text default 'Paid') returns text
language plpgsql security invoker set search_path=public as $$
declare r public.registration_requests; p public.membership_plans; b public.branches; member_id text; membership_id text; next_number integer; choice jsonb; start_date date; amount_paid numeric; months integer;
begin
 if public.staff_role() is null then raise exception 'Staff access required';end if;
 if jsonb_typeof(selected_memberships) is distinct from 'array' then raise exception 'Choose at least one class membership';end if;
 if jsonb_array_length(selected_memberships) not between 1 and 50 then raise exception 'Choose between 1 and 50 memberships';end if;
 if (select count(distinct value->>'planId') from jsonb_array_elements(selected_memberships))<>jsonb_array_length(selected_memberships) then raise exception 'Choose each membership only once';end if;
 if payment_method not in ('Cash','Online Transfer','Credit/Debit Card','E-Wallet','Other') or payment_status not in ('Paid','Pending','Partial','Overdue') then raise exception 'Invalid payment method or status';end if;
 perform pg_advisory_xact_lock(824312);
 select * into r from public.registration_requests where id=request_id for update;
 if not found then raise exception 'Registration was not found';end if;
 if r.status='APPROVED' then return r."memberId";end if;
 if r.status<>'PENDING' then raise exception 'Only pending requests can be approved';end if;
 if exists(select 1 from public.members where (r.ic<>'' and lower(ic)=lower(r.ic)) or (r.email<>'' and lower(email)=lower(r.email)) or regexp_replace(phone,'[^0-9]','','g')=r."phoneKey") then raise exception 'A member with these details exists. Review the existing member instead';end if;
 select * into b from public.branches where id=r."branchId" and active and not deleted;
 if not found then raise exception 'This branch is inactive';end if;
 select coalesce(max(substring(id from '[0-9]+$')::integer),0)+1 into next_number from public.members where id like 'HYB-'||b.code||'-%';
 member_id='HYB-'||b.code||'-'||lpad(next_number::text,greatest(5,length(next_number::text)),'0');
 insert into public.members(id,name,ic,dob,gender,phone,email,"emergencyName","emergencyPhone",address,registered,"branchId",photo,medical,notes,coach,"classIds")
 values(member_id,r.name,r.ic,r.dob,r.gender,r.phone,r.email,r."emergencyName",r."emergencyPhone",r.address,(now() at time zone 'Asia/Kuala_Lumpur')::date,r."branchId",'','',r.notes,'','{}'::text[]);
 for choice in select value from jsonb_array_elements(selected_memberships) loop
 select * into p from public.membership_plans where id=choice->>'planId' and "branchId"=r."branchId" and active and not deleted;
 if not found then raise exception 'Select an active plan from the registration branch';end if;
 start_date=(choice->>'start')::date; months=(choice->>'months')::integer; amount_paid=(choice->>'amount')::numeric;
 if start_date is null or months is null or months<1 or (choice->>'months')::numeric<>months or amount_paid is null or amount_paid<0 or amount_paid::text in ('NaN','Infinity','-Infinity') then raise exception 'Check membership start date, duration and payment amount';end if;
 membership_id=gen_random_uuid()::text;
 update public.members set "classIds"=array(select distinct unnest("classIds"||p.classes)) where id=member_id;
 insert into public.memberships(id,"memberId","planId",start,expiry,state) values(membership_id,member_id,p.id,start_date,(start_date+make_interval(months=>months))::date,'NORMAL');
 if amount_paid>0 then insert into public.payments(id,"memberId","membershipId",amount,date,method,reference,notes,status)
 values(gen_random_uuid()::text,member_id,membership_id,amount_paid,(now() at time zone 'Asia/Kuala_Lumpur')::date,payment_method,'','QR registration',payment_status);end if;
 end loop;
 update public.registration_requests set status='APPROVED',"memberId"=member_id,"reviewedAt"=now(),"reviewedBy"=auth.uid() where id=r.id;
 return member_id;
end $$;
revoke all on function public.approve_registration_memberships(uuid,jsonb,text,text) from public;
grant execute on function public.approve_registration_memberships(uuid,jsonb,text,text) to authenticated;

commit;
