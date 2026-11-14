-- Match the Hybrid Google Form while retaining private staff-only access and existing arrival/approval behavior.
begin;
alter table public.registration_requests add column if not exists "formAnswers" jsonb;
create or replace function public.registration_options(branch_code text) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('hybridFormVersion',1,'branch',jsonb_build_object('id',b.id,'name',b.name,'code',b.code))
 from public.branches b where lower(b.code)=lower(branch_code) and b.active and not b.deleted
$$;
revoke all on function public.registration_options(text) from public;
grant execute on function public.registration_options(text) to anon,authenticated;
create or replace function public.submit_registration(branch_code text, details jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b public.branches; phone_key text; birth date; new_id uuid; answers jsonb; question_key text;
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

 answers=details->'formAnswers';
 if jsonb_typeof(answers) is distinct from 'object' then raise exception 'Complete the Hybrid membership application';end if;
 if coalesce(details->>'email','')='' or coalesce(details->>'dob','')='' or length(trim(coalesce(details->>'address','')))=0 then raise exception 'Email, date of birth and current address are required';end if;
 if coalesce(details->>'gender','') not in ('Male','Female') then raise exception 'Select your gender';end if;
 if length(regexp_replace(coalesce(details->>'emergencyPhone',''),'[^0-9]','','g')) not between 7 and 20 then raise exception 'Enter a valid emergency contact number';end if;
 if coalesce(answers->>'age','') !~ '^[0-9]{1,3}$' then raise exception 'Enter a valid age';end if;
 if (answers->>'age')::integer not between 1 and 125 then raise exception 'Enter a valid age';end if;
 foreach question_key in array array['heart','chestPain','dizziness','diabetes','asthma','joint','otherHealth'] loop
  if coalesce(answers->'health'->>question_key,'') not in ('Yes','No') then raise exception 'Answer every health background question';end if;
 end loop;
 if coalesce(answers->>'referral','') not in ('I live nearby','Google','Family/Friends','Social media','Other') then raise exception 'Select how you found out about Hybrid';end if;
 if answers->>'referral'='Other' and length(trim(coalesce(answers->>'referralOther','')))=0 then raise exception 'Specify how you found out about Hybrid';end if;
 if coalesce(answers->'responses'->>'2011207499','') not in ('Name :','Phone no:') then raise exception 'Select the emergency contact detail';end if;
 foreach question_key in array array['1873781823','1429873490','497265150','780259237','663793279'] loop
  if coalesce(answers->'responses'->>question_key,'') <> 'Yes' then raise exception 'Confirm all required rules and regulations acknowledgements';end if;
 end loop;
 select * into b from public.branches where lower(code)=lower(branch_code) and active and not deleted;
 if not found then raise exception 'This branch is not accepting registrations';end if;
 -- Serialize submissions per branch so caps and duplicate checks remain atomic.
 perform pg_advisory_xact_lock(hashtextextended('qr-registration:'||b.id,0));
 -- The same phone cannot create repeated pending registrations. No existing details are returned.
 if exists(select 1 from public.registration_requests where "branchId"=b.id and "phoneKey"=phone_key and status='PENDING') then return jsonb_build_object('received',true);end if;
 if (select count(*) from public.registration_requests where "branchId"=b.id and "phoneKey"=phone_key and "checkedInAt">now()-interval '24 hours')>=3 then raise exception 'Please speak to reception to complete your registration';end if;
 if (select count(*) from public.registration_requests where "branchId"=b.id and "checkedInAt">now()-interval '1 hour')>=100 then raise exception 'Registration is busy. Please speak to reception';end if;
 insert into public.registration_requests("branchId",name,phone,"phoneKey",email,ic,dob,gender,address,"emergencyName","emergencyPhone",notes,"formAnswers")
 values(b.id,trim(details->>'name'),trim(details->>'phone'),phone_key,lower(trim(coalesce(details->>'email',''))),trim(coalesce(details->>'ic','')),birth,coalesce(details->>'gender',''),coalesce(details->>'address',''),coalesce(details->>'emergencyName',''),coalesce(details->>'emergencyPhone',''),coalesce(details->>'notes',''),answers) returning id into new_id;
 return jsonb_build_object('received',true);
end $$;
revoke all on function public.submit_registration(text,jsonb) from public;
grant execute on function public.submit_registration(text,jsonb) to anon,authenticated;

commit;
