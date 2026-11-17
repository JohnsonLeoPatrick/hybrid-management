begin;
create table private.gym_check_in_codes (
 "branchId" text primary key references public.branches(id),
 token uuid not null unique default gen_random_uuid(),
 window_start timestamptz not null default date_trunc('minute',now()),
 attempts integer not null default 0
);
alter table private.gym_check_in_codes enable row level security;
revoke all on private.gym_check_in_codes from public,anon,authenticated;

-- Privileged operations stay outside the exposed API schema.
create function private.gym_check_in_qr(branch_id text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or public.staff_role() is distinct from 'SUPER ADMIN' then
  raise exception 'A signed-in super administrator is required';
 end if;
 if not exists(select 1 from public.branches where id=branch_id and active and not deleted) then
  raise exception 'Choose an active branch';
 end if;
 insert into private.gym_check_in_codes("branchId") values(branch_id) on conflict do nothing;
 select token into result from private.gym_check_in_codes where "branchId"=branch_id;
 return result;
end;
$$;
revoke all on function private.gym_check_in_qr(text) from public,anon,authenticated;
grant execute on function private.gym_check_in_qr(text) to authenticated;

create function private.gym_check_in_options(qr_token uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('branchName',b.name)
 from private.gym_check_in_codes q join public.branches b on b.id=q."branchId"
 where q.token=qr_token and b.active and not b.deleted
$$;
revoke all on function private.gym_check_in_options(uuid) from public,anon,authenticated;
grant execute on function private.gym_check_in_options(uuid) to anon,authenticated;

create function private.submit_gym_check_in(qr_token uuid,member_identifier text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q private.gym_check_in_codes; matches text[]; term text; visit_date date; inserted integer;
begin
 select codes.* into q from private.gym_check_in_codes codes
 join public.branches b on b.id=codes."branchId" and b.active and not b.deleted
 where codes.token=qr_token for update of codes;
 if not found then return jsonb_build_object('status','unavailable');end if;
 -- Count failed lookups too. Returning a status commits the counter instead of rolling it back.
 if q.window_start=date_trunc('minute',now()) and q.attempts>=60 then
  return jsonb_build_object('status','busy');
 end if;
 update private.gym_check_in_codes
 set attempts=case when window_start=date_trunc('minute',now()) then attempts+1 else 1 end,
 window_start=date_trunc('minute',now()) where token=qr_token;
 if length(coalesce(member_identifier,'')) not between 1 and 120 then
  return jsonb_build_object('status','invalid');
 end if;
 term=lower(regexp_replace(btrim(member_identifier),'[[:space:]]+',' ','g'));
 if term='' then return jsonb_build_object('status','invalid');end if;
 select array_agg(candidate.id) into matches from (
  select m.id from public.members m where m."branchId"=q."branchId" and not m.deleted and (
   lower(m.id)=term or
   lower(regexp_replace(btrim(m.name),'[[:space:]]+',' ','g'))=term or
   (term ~ '^[0-9]+$' and m."membershipNumber"::text=regexp_replace(term,'^0+',''))
  ) limit 2
 ) candidate;
 if coalesce(array_length(matches,1),0)=0 then return jsonb_build_object('status','not_found');end if;
 if array_length(matches,1)>1 then return jsonb_build_object('status','ambiguous');end if;
 visit_date=(now() at time zone 'Asia/Kuala_Lumpur')::date;
 insert into public.attendance(id,"memberId","classId",date)
 values(gen_random_uuid()::text,matches[1],null,visit_date)
 on conflict ("memberId",date) where "classId" is null do nothing;
 get diagnostics inserted=row_count;
 return jsonb_build_object('status',case when inserted=1 then 'checked_in' else 'already_checked_in' end,'date',visit_date);
end;
$$;
revoke all on function private.submit_gym_check_in(uuid,text) from public,anon,authenticated;
grant execute on function private.submit_gym_check_in(uuid,text) to anon,authenticated;

-- Schema usage permits these explicit calls, never direct access to private tables.
grant usage on schema private to anon,authenticated;
create function public.gym_check_in_qr(branch_id text) returns uuid
language sql security invoker set search_path='' as $$select private.gym_check_in_qr(branch_id)$$;
revoke all on function public.gym_check_in_qr(text) from public,anon,authenticated;
grant execute on function public.gym_check_in_qr(text) to authenticated;

create function public.gym_check_in_options(qr_token uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.gym_check_in_options(qr_token)$$;
revoke all on function public.gym_check_in_options(uuid) from public,anon,authenticated;
grant execute on function public.gym_check_in_options(uuid) to anon,authenticated;

create function public.submit_gym_check_in(qr_token uuid,member_identifier text) returns jsonb
language sql security invoker set search_path='' as $$select private.submit_gym_check_in(qr_token,member_identifier)$$;
revoke all on function public.submit_gym_check_in(uuid,text) from public,anon,authenticated;
grant execute on function public.submit_gym_check_in(uuid,text) to anon,authenticated;
commit;
