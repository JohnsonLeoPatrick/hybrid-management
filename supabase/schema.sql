-- Run once in the Supabase SQL editor. All application writes remain subject to RLS.
create table public.branches (id text primary key, name text not null, code text unique not null check(code ~ '^[A-Z0-9]{2,8}$'), address text not null default '', phone text not null default '', active boolean not null default true, deleted boolean not null default false);
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, name text not null default '', deleted boolean not null default false);
create table public.staff (id text primary key check(id::uuid is not null), name text not null, email text not null, role text not null check(role in ('SUPER ADMIN','ADMIN','STAFF')), "branchId" text references public.branches(id), deleted boolean not null default false);
create table public.classes (id text primary key, name text not null, coach text not null, "branchId" text not null references public.branches(id), day text not null, start time not null, "end" time, capacity integer not null check(capacity>0), deleted boolean not null default false, check("end">start));
create table public.membership_plans (id text primary key, name text not null, months integer not null check(months>0), price numeric(12,2) not null check(price>=0), description text not null default '', "branchId" text not null references public.branches(id), classes text[] not null default '{}', active boolean not null default true, deleted boolean not null default false);
create table public.members (id text primary key, name text not null check(length(trim(name))>0), ic text not null default '', dob date, gender text not null default '', phone text not null default '', email text not null default '', "emergencyName" text not null default '', "emergencyPhone" text not null default '', address text not null default '', registered date not null default current_date, "branchId" text not null references public.branches(id), photo text not null default '', medical text not null default '', notes text not null default '', coach text not null default '', "classIds" text[] not null default '{}', deleted boolean not null default false);
create unique index members_ic_unique on public.members(lower(ic)) where ic<>'';
create unique index members_email_unique on public.members(lower(email)) where email<>'';
create index members_branch on public.members("branchId");
create table public.memberships (id text primary key, "memberId" text not null references public.members(id), "planId" text not null references public.membership_plans(id), start date not null, expiry date not null, state text not null default 'NORMAL' check(state in ('NORMAL','FROZEN','CANCELLED')), created timestamptz not null default now(), deleted boolean not null default false, check(expiry>=start));
create index memberships_member on public.memberships("memberId", created desc);
create index memberships_expiry on public.memberships(expiry);
create table public.membership_renewals (id text primary key, "memberId" text not null references public.members(id), "previousId" text not null references public.memberships(id), "membershipId" text unique not null references public.memberships(id), date date not null, deleted boolean not null default false);
create table public.payments (id text primary key, "memberId" text not null references public.members(id), "membershipId" text not null references public.memberships(id), amount numeric(12,2) not null check(amount>0), date date not null, method text not null check(method in ('Cash','Online Transfer','Credit/Debit Card','E-Wallet','Other')), reference text not null default '', notes text not null default '', status text not null check(status in ('Paid','Pending','Partial','Overdue')), deleted boolean not null default false);
create table public.member_classes ("memberId" text references public.members(id), "classId" text references public.classes(id), primary key("memberId","classId"));
create table public.plan_classes ("planId" text references public.membership_plans(id), "classId" text references public.classes(id), primary key("planId","classId"));
create table public.attendance (id text primary key, "memberId" text not null references public.members(id), "classId" text not null references public.classes(id), date date not null, deleted boolean not null default false, unique("memberId","classId",date));
create table public.notes (id uuid primary key default gen_random_uuid(), "memberId" text not null references public.members(id), body text not null, "createdBy" uuid not null default auth.uid() references auth.users(id), created timestamptz not null default now(), deleted boolean not null default false);

create function public.staff_role() returns text language sql stable security definer set search_path=public as $$ select role from public.staff where id=auth.uid()::text and not deleted $$;
revoke all on function public.staff_role() from public;
grant execute on function public.staff_role() to authenticated;
do $$ declare t text; begin
 foreach t in array array['branches','profiles','staff','classes','membership_plans','members','memberships','membership_renewals','payments','member_classes','plan_classes','attendance','notes'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy staff_read on public.%I for select to authenticated using (public.staff_role() is not null)',t);
 end loop;
 foreach t in array array['members','memberships','membership_renewals','payments','attendance','notes','member_classes'] loop
 execute format('create policy staff_insert on public.%I for insert to authenticated with check (public.staff_role() is not null)',t);
 end loop;
 foreach t in array array['members','payments','member_classes'] loop
 execute format('create policy staff_update on public.%I for update to authenticated using (public.staff_role() is not null) with check (public.staff_role() is not null)',t);
 end loop;
 foreach t in array array['classes','membership_plans','plan_classes'] loop
 execute format('create policy admin_write on public.%I for all to authenticated using (public.staff_role() in (''ADMIN'',''SUPER ADMIN'')) with check (public.staff_role() in (''ADMIN'',''SUPER ADMIN''))',t);
 end loop;
 foreach t in array array['branches','staff','profiles'] loop
 execute format('create policy super_write on public.%I for all to authenticated using (public.staff_role() = ''SUPER ADMIN'') with check (public.staff_role() = ''SUPER ADMIN'')',t);
 end loop;
end $$;
create policy membership_state_update on public.memberships for update to authenticated using (public.staff_role() in ('ADMIN','SUPER ADMIN')) with check (public.staff_role() in ('ADMIN','SUPER ADMIN'));
create policy enrollment_delete on public.member_classes for delete to authenticated using(public.staff_role() is not null);

-- Preserve financial and membership history. State changes are the only membership updates.
create function public.protect_membership_history() returns trigger language plpgsql as $$ begin
 if (to_jsonb(new)-'state') is distinct from (to_jsonb(old)-'state') then raise exception 'Historical membership fields cannot be changed; create a renewal'; end if;return new;end $$;
create trigger preserve_memberships before update on public.memberships for each row execute function public.protect_membership_history();
create function public.protect_payment_history() returns trigger language plpgsql as $$ begin
 if (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then raise exception 'Only payment settlement status can be updated';end if;return new;end $$;
create trigger preserve_payments before update on public.payments for each row execute function public.protect_payment_history();
create function public.validate_record_links() returns trigger language plpgsql set search_path=public as $$ begin
 if tg_table_name='staff' then
 if not exists(select 1 from auth.users where id=new.id::uuid) then raise exception 'Create the staff account in Supabase Authentication first';end if;
 elsif tg_table_name='payments' then
 if not exists(select 1 from public.memberships where id=new."membershipId" and "memberId"=new."memberId") then raise exception 'Payment membership does not belong to this member';end if;
 elsif tg_table_name='membership_renewals' then
 if not exists(select 1 from public.memberships where id=new."membershipId" and "memberId"=new."memberId") or not exists(select 1 from public.memberships where id=new."previousId" and "memberId"=new."memberId") or new."previousId"=new."membershipId" then raise exception 'Renewal must link two memberships belonging to the same member';end if;
 elsif tg_table_name='attendance' then
 if not exists(select 1 from public.member_classes where "memberId"=new."memberId" and "classId"=new."classId") then raise exception 'Member must be enrolled in the class';end if;
 end if;return new;end $$;
-- The Auth lookup runs with a fixed search path and is only reachable through staff-admin RLS.
create function public.validate_staff_account() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if not exists(select 1 from auth.users where id=new.id::uuid) then raise exception 'Create the staff account in Supabase Authentication first';end if;return new;end $$;
create trigger staff_auth_link before insert or update on public.staff for each row execute function public.validate_staff_account();
create trigger payment_member_link before insert on public.payments for each row execute function public.validate_record_links();
create trigger renewal_member_link before insert on public.membership_renewals for each row execute function public.validate_record_links();
create trigger attendance_enrollment before insert on public.attendance for each row execute function public.validate_record_links();

-- Synchronize normalized class relationships; lock classes to enforce capacity under concurrency.
create function public.sync_enrollment() returns trigger language plpgsql security definer set search_path=public as $$ declare cid text; c public.classes; begin
 if public.staff_role() is null then raise exception 'Staff access required';end if;
 delete from public.member_classes where "memberId"=new.id;
 foreach cid in array new."classIds" loop
 select * into strict c from public.classes where id=cid for update;
 if c."branchId"<>new."branchId" or c.deleted then raise exception 'Class branch mismatch or archived class';end if;
 if (select count(*) from public.member_classes where "classId"=cid)>=c.capacity then raise exception 'Class capacity reached';end if;
 insert into public.member_classes values(new.id,cid);
 end loop;return new;end $$;
create trigger sync_member_classes after insert or update of "classIds","branchId" on public.members for each row execute function public.sync_enrollment();
create function public.sync_plan_classes() returns trigger language plpgsql set search_path=public as $$ declare cid text;begin
 delete from public.plan_classes where "planId"=new.id;
 foreach cid in array new.classes loop
 if not exists(select 1 from public.classes where id=cid and "branchId"=new."branchId" and not deleted) then raise exception 'Included class must belong to the plan branch';end if;
 insert into public.plan_classes values(new.id,cid);end loop;return new;end $$;
create trigger sync_plan_class_links after insert or update of classes,"branchId" on public.membership_plans for each row execute function public.sync_plan_classes();
create function public.validate_membership() returns trigger language plpgsql set search_path=public as $$ begin
 if not exists(select 1 from public.members m join public.membership_plans p on p."branchId"=m."branchId" where m.id=new."memberId" and p.id=new."planId" and p.active and not p.deleted) then raise exception 'Membership plan must be active and belong to the member branch';end if;return new;end $$;
create trigger validate_membership_branch before insert on public.memberships for each row execute function public.validate_membership();

-- Transactional batch API: SECURITY INVOKER deliberately enforces each table's RLS.
create function public.apply_changes(changes jsonb, deletions jsonb default '[]'::jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare change jsonb; tbl text; payload jsonb; cols text; updates text; exists_row boolean;
begin
 if public.staff_role() is null then raise exception 'Staff access required';end if;
 -- Serialize ID allocation and multi-row registrations. Unique IDs reject stale client allocations safely.
 perform pg_advisory_xact_lock(824312);
 for change in select value from jsonb_array_elements(changes) loop
 tbl=change->>'table';
 if tbl not in ('branches','staff','classes','membership_plans','members','memberships','payments','membership_renewals','attendance') then raise exception 'Invalid table';end if;
 payload=jsonb_build_object('deleted',false)||(change->'data');
 if tbl='members' and payload->>'dob'='' then payload=jsonb_set(payload,'{dob}','null'::jsonb);end if;
 if tbl='classes' and payload->>'end'='' then payload=jsonb_set(payload,'{end}','null'::jsonb);end if;
 select string_agg(format('%I',key),','),string_agg(format('%I=excluded.%I',key,key),',') into cols,updates from jsonb_object_keys(payload) key where key<>'id';
 execute format('select exists(select 1 from public.%I where id=$1)',tbl) into exists_row using change->>'id';
 if exists_row and coalesce((change->>'isNew')::boolean,false) then raise exception 'Record ID already exists. Refresh the workspace and retry.';end if;
 if exists_row then
 -- Memberships and payments only permit their explicitly allowed state/status update.
 if tbl='memberships' then
 if public.staff_role() not in ('ADMIN','SUPER ADMIN') then raise exception 'Permission denied: membership state requires admin';end if;
 execute 'update public.memberships set state=$1 where id=$2' using payload->>'state',change->>'id';
 elsif tbl='payments' then execute 'update public.payments set status=$1 where id=$2' using payload->>'status',change->>'id';
 else execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1) on conflict(id) do update set %s',tbl,tbl,updates) using payload;end if;
 else execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1)',tbl,tbl) using payload;end if;
 end loop;
 for change in select value from jsonb_array_elements(deletions) loop
 if change->>'table'<>'classes' then raise exception 'Only classes can be archived';end if;
 if public.staff_role() not in ('ADMIN','SUPER ADMIN') then raise exception 'Permission denied: class archive requires admin';end if;
 update public.classes set deleted=true where id=change->>'id';
 end loop;
end $$;
revoke all on function public.apply_changes(jsonb,jsonb) from public;
grant execute on function public.apply_changes(jsonb,jsonb) to authenticated;
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.branches,public.profiles,public.staff,public.classes,public.membership_plans,public.members,public.memberships,public.membership_renewals,public.payments,public.member_classes,public.plan_classes,public.attendance,public.notes to authenticated;
insert into public.branches(id,name,code,address,phone) values('dd','Hybrid DD','DD','Desa Damansara, Kuala Lumpur','');
-- Bootstrap only in SQL editor after creating an Auth user:
-- insert into public.staff(id,name,email,role,"branchId") values ('AUTH-USER-UUID','Your Name','you@example.com','SUPER ADMIN','dd');
