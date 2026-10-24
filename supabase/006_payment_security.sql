-- Apply after 005. Existing accounts start with payment access denied.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.payment_credentials (
 user_id uuid primary key references auth.users(id) on delete cascade,
 password_hash text not null,
 enabled boolean not null default true,
 failures integer not null default 0,
 locked_until timestamptz,
 changed_at timestamptz not null default now()
);
create table private.payment_sessions (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null
);
alter table private.payment_credentials enable row level security;
alter table private.payment_sessions enable row level security;
revoke all on private.payment_credentials,private.payment_sessions from public, anon, authenticated;

create function public.payment_access() returns boolean
language sql stable security definer set search_path='' as $$
 select public.staff_role() is not null and exists (
  select 1 from private.payment_sessions p
  join private.payment_credentials c on c.user_id=p.user_id and c.enabled
  join auth.sessions s on s.id=p.session_id and s.user_id=p.user_id
  where p.user_id=auth.uid() and p.session_id=(auth.jwt()->>'session_id')::uuid
   and p.expires_at>now()
 );
$$;

create function public.set_payment_access(staff_id uuid, new_password text, allow_access boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if public.staff_role() is distinct from 'SUPER ADMIN' then raise exception 'Super admin access required';end if;
 if not exists(select 1 from public.staff where id=staff_id::text and not deleted) then raise exception 'Staff account not found';end if;
 if allow_access and (new_password is null or length(new_password)<7 or octet_length(new_password)>72) then
  raise exception 'Use a separate payment password: at least 7 characters, at most 72 bytes';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(staff_id::text, 9462));
 delete from private.payment_sessions where user_id=staff_id;
 if allow_access then
  insert into private.payment_credentials(user_id,password_hash) values(staff_id,extensions.crypt(new_password,extensions.gen_salt('bf',12)))
  on conflict(user_id) do update set password_hash=excluded.password_hash,enabled=true,failures=0,locked_until=null,changed_at=now();
 else
  update private.payment_credentials set enabled=false,changed_at=now() where user_id=staff_id;
 end if;
end;
$$;

-- Return false on failure so attempt counters commit instead of rolling back with an exception.
create function public.unlock_payments(payment_password text) returns boolean
language plpgsql security definer set search_path='' as $$
declare credential private.payment_credentials; sid uuid;
begin
 if public.staff_role() is null then return false;end if;
 sid=(auth.jwt()->>'session_id')::uuid;
 if sid is null or not exists(select 1 from auth.sessions where id=sid and user_id=auth.uid()) then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 9462));
 select * into credential from private.payment_credentials where user_id=auth.uid() for update;
 if not found or not credential.enabled or credential.locked_until>now() then return false;end if;
 if payment_password is null or octet_length(payment_password)>72 or extensions.crypt(payment_password,credential.password_hash)<>credential.password_hash then
  update private.payment_credentials set
   failures=case when locked_until<=now() then 1 else failures+1 end,
   locked_until=case when locked_until<=now() then null when failures+1>=5 then now()+interval '15 minutes' else null end
   where user_id=auth.uid();
  return false;
 end if;
 update private.payment_credentials set failures=0,locked_until=null where user_id=auth.uid();
 insert into private.payment_sessions(session_id,user_id,expires_at) values(sid,auth.uid(),now()+interval '15 minutes')
 on conflict(session_id) do update set expires_at=excluded.expires_at;
 return true;
end;
$$;

create function public.lock_payments() returns void
language sql security definer set search_path='' as $$
 delete from private.payment_sessions where user_id=auth.uid() and session_id=(auth.jwt()->>'session_id')::uuid;
$$;

-- Restrictive policies also constrain existing permissive staff policies and SECURITY INVOKER RPCs.
create policy payment_unlock_required on public.payments as restrictive for all to authenticated
 using (public.payment_access()) with check (public.payment_access());
revoke all on function public.payment_access(),public.set_payment_access(uuid,text,boolean),public.unlock_payments(text),public.lock_payments() from public,anon;
grant execute on function public.payment_access(),public.set_payment_access(uuid,text,boolean),public.unlock_payments(text),public.lock_payments() to authenticated;
commit;
