-- Membership numbers may be reassigned; record IDs and all financial/history links stay immutable.
begin;
alter table public.members add column "membershipNumber" integer check ("membershipNumber" > 0);
do $$
declare member_row record; preferred integer;
begin
 for member_row in select id,"branchId" from public.members order by registered,id loop
  preferred=null;
  if member_row.id ~ '^HYB-[A-Z0-9]+-[0-9]{1,9}$' then preferred=substring(member_row.id from '[0-9]+$')::integer;end if;
  if coalesce(preferred,0)<1 or exists(select 1 from public.members where "branchId"=member_row."branchId" and "membershipNumber"=preferred) then
   select coalesce(max("membershipNumber"),0)+1 into preferred from public.members where "branchId"=member_row."branchId";
  end if;
  update public.members set "membershipNumber"=preferred where id=member_row.id;
 end loop;
end $$;
create unique index members_branch_membership_number on public.members("branchId","membershipNumber") where "membershipNumber" is not null;

create function public.member_number_reusable(member_id text) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce((select bool_and(state<>'FROZEN') from (
  select distinct on ("planId") state,expiry from public.memberships where "memberId"=m.id and not deleted order by "planId",created desc,id desc
 ) latest),true)
 and (coalesce((select max(expiry) from (
  select distinct on ("planId") expiry from public.memberships where "memberId"=m.id and not deleted order by "planId",created desc,id desc
 ) latest),m.registered)+interval '6 months')::date <= (now() at time zone 'Asia/Kuala_Lumpur')::date
 from public.members m where m.id=member_id
$$;
revoke all on function public.member_number_reusable(text) from public, anon, authenticated;

create function public.allocate_membership_number(branch_id text, member_id text) returns integer
language plpgsql security definer set search_path=public as $$
declare allocated integer;
begin
 perform pg_advisory_xact_lock(824312);
 select number into allocated
 from generate_series(1,(select count(*)::integer+1 from public.members where "branchId"=branch_id)) number
 where not exists(select 1 from public.members m where m."branchId"=branch_id and m."membershipNumber"=number and m.id<>member_id and not public.member_number_reusable(m.id))
 order by number limit 1;
 update public.members set "membershipNumber"=null where "branchId"=branch_id and "membershipNumber"=allocated and id<>member_id;
 return allocated;
end $$;
revoke all on function public.allocate_membership_number(text,text) from public, anon, authenticated;

create function public.assign_membership_number() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 -- Nested updates are allocator releases or renewal assignments, never client-supplied numbers.
 if pg_trigger_depth()>1 then return new;end if;
 if tg_op='INSERT' then
  select "membershipNumber" into new."membershipNumber" from public.members where id=new.id and "branchId"=new."branchId";
  if found then return new;end if;
 end if;
 if tg_op='UPDATE' then
  if old."branchId"=new."branchId" then new."membershipNumber"=old."membershipNumber";return new;end if;
 end if;
 new."membershipNumber"=public.allocate_membership_number(new."branchId",new.id);
 return new;
end $$;
revoke all on function public.assign_membership_number() from public, anon, authenticated;
create trigger assign_member_number before insert or update of "membershipNumber","branchId" on public.members for each row execute function public.assign_membership_number();

create function public.ensure_renewal_member_number() returns trigger
language plpgsql security definer set search_path=public as $$
declare member_row public.members;
begin
 perform pg_advisory_xact_lock(824312);
 select * into member_row from public.members where id=new."memberId" for update;
 if member_row."membershipNumber" is null then
  update public.members set "membershipNumber"=public.allocate_membership_number(member_row."branchId",member_row.id) where id=member_row.id;
 end if;
 return new;
end $$;
revoke all on function public.ensure_renewal_member_number() from public, anon, authenticated;
create trigger ensure_renewal_number before insert on public.memberships for each row execute function public.ensure_renewal_member_number();

insert into public.membership_plans(id,name,months,price,description,"branchId",classes,active)
select 'hybrid-gym-'||kind||case when b.id='dd' then '' else '-'||b.id end,
 'Normal Gym — '||case when kind='adult' then 'Adult' else 'Student' end,1,
 case when kind='adult' then 90 else 70 end,
 'Gym access only; martial arts classes are sold separately.',b.id,'{}'::text[],true
from public.branches b cross join (values ('adult'),('student')) tiers(kind) where b.active and not b.deleted
on conflict(id) do nothing;
commit;
