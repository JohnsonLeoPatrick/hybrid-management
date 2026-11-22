begin;
create table private.branch_credentials (
 branch_id text primary key references public.branches(id),
 password_hash text not null
);
create table private.branch_sessions (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 branch_id text not null references public.branches(id),
 password_version text not null,
 expires_at timestamptz not null
);
create table private.branch_attempts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 failures integer not null default 0,
 locked_until timestamptz
);
alter table private.branch_credentials enable row level security;
alter table private.branch_sessions enable row level security;
alter table private.branch_attempts enable row level security;
revoke all on private.branch_credentials,private.branch_sessions,private.branch_attempts from public,anon,authenticated;

create function private.current_branch() returns text
language sql stable security definer set search_path='' as $$
 select p.branch_id from private.branch_sessions p
 join auth.sessions s on s.id=p.session_id and s.user_id=p.user_id
 join private.branch_credentials c on c.branch_id=p.branch_id and md5(c.password_hash)=p.password_version
 join public.branches b on b.id=p.branch_id and b.active and not b.deleted
 where auth.uid() is not null and public.staff_role() is not null
 and p.user_id=auth.uid() and p.session_id=(auth.jwt()->>'session_id')::uuid and p.expires_at>now()
$$;

create function private.unlock_branch(branch_id text,branch_password text) returns boolean
language plpgsql security definer set search_path='' as $$
declare sid uuid; credential text; attempts private.branch_attempts;
begin
 if auth.uid() is null or public.staff_role() is null then return false;end if;
 sid=(auth.jwt()->>'session_id')::uuid;
 if sid is null or not exists(select 1 from auth.sessions where id=sid and user_id=auth.uid()) then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,9464));
 insert into private.branch_attempts(user_id) values(auth.uid()) on conflict do nothing;
 select * into strict attempts from private.branch_attempts where user_id=auth.uid() for update;
 if attempts.locked_until>now() then return false;end if;
 select c.password_hash into credential from private.branch_credentials c
 join public.branches b on b.id=c.branch_id and b.active and not b.deleted where c.branch_id=unlock_branch.branch_id;
 if credential is null or branch_password is null or octet_length(branch_password)>72
 or extensions.crypt(branch_password,credential) is distinct from credential then
  update private.branch_attempts set
   failures=case when locked_until<=now() then 1 else failures+1 end,
   locked_until=case when locked_until<=now() then null when failures+1>=5 then now()+interval '15 minutes' else null end
  where user_id=auth.uid();
  return false;
 end if;
 update private.branch_attempts set failures=0,locked_until=null where user_id=auth.uid();
 insert into private.branch_sessions(session_id,user_id,branch_id,password_version,expires_at)
 values(sid,auth.uid(),branch_id,md5(credential),now()+interval '24 hours')
 on conflict(session_id) do update set branch_id=excluded.branch_id,password_version=excluded.password_version,expires_at=excluded.expires_at;
 return true;
end;
$$;
create function private.lock_branch() returns void
language sql security definer set search_path='' as $$
 delete from private.branch_sessions where auth.uid() is not null and user_id=auth.uid() and session_id=(auth.jwt()->>'session_id')::uuid
$$;
revoke all on function private.current_branch(),private.unlock_branch(text,text),private.lock_branch() from public,anon,authenticated;
grant execute on function private.current_branch(),private.unlock_branch(text,text),private.lock_branch() to authenticated;
grant usage on schema private to authenticated;

create function public.current_branch() returns text language sql stable security invoker set search_path='' as $$select private.current_branch()$$;
create function public.unlock_branch(branch_id text,branch_password text) returns boolean language sql security invoker set search_path='' as $$select private.unlock_branch(branch_id,branch_password)$$;
create function public.lock_branch() returns void language sql security invoker set search_path='' as $$select private.lock_branch()$$;
revoke all on function public.current_branch(),public.unlock_branch(text,text),public.lock_branch() from public,anon;
grant execute on function public.current_branch(),public.unlock_branch(text,text),public.lock_branch() to authenticated;

-- Branch names remain available for the picker. Operational records require a branch unlock.
do $$declare t text;begin
 foreach t in array array['classes','membership_plans','members','registration_requests'] loop
  execute format('create policy branch_unlock_required on public.%I as restrictive for all to authenticated using ("branchId"=(select public.current_branch())) with check ("branchId"=(select public.current_branch()))',t);
 end loop;
 foreach t in array array['memberships','membership_renewals','payments','attendance','notes','member_classes'] loop
  execute format('create policy branch_unlock_required on public.%I as restrictive for all to authenticated using (exists(select 1 from public.members m where m.id="memberId" and m."branchId"=(select public.current_branch()))) with check (exists(select 1 from public.members m where m.id="memberId" and m."branchId"=(select public.current_branch())))',t);
 end loop;
end$$;
create policy branch_unlock_required on public.plan_classes as restrictive for all to authenticated
 using(exists(select 1 from public.membership_plans p where p.id="planId" and p."branchId"=(select public.current_branch())))
 with check(exists(select 1 from public.membership_plans p where p.id="planId" and p."branchId"=(select public.current_branch())));
commit;
