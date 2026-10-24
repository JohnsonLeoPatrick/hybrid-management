-- Staff administration needs a separate account-password confirmation, never a payment unlock.
begin;
create table private.staff_sessions (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 password_version text not null,
 expires_at timestamptz not null
);
create table private.staff_unlock_attempts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 failures integer not null default 0,
 locked_until timestamptz
);
alter table private.staff_sessions enable row level security;
alter table private.staff_unlock_attempts enable row level security;
revoke all on private.staff_sessions,private.staff_unlock_attempts from public,anon,authenticated;

create function public.staff_access() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(public.staff_role()='SUPER ADMIN',false) and exists(
  select 1 from private.staff_sessions p
  join auth.sessions s on s.id=p.session_id and s.user_id=p.user_id
  join auth.users u on u.id=p.user_id and md5(u.encrypted_password)=p.password_version
  where p.user_id=auth.uid() and p.session_id=(auth.jwt()->>'session_id')::uuid and p.expires_at>now()
 );
$$;
create function public.unlock_staff(account_password text) returns boolean
language plpgsql security definer set search_path='' as $$
declare sid uuid; password_hash text; attempts private.staff_unlock_attempts;
begin
 if public.staff_role() is distinct from 'SUPER ADMIN' then return false;end if;
 sid=(auth.jwt()->>'session_id')::uuid;
 if sid is null or not exists(select 1 from auth.sessions where id=sid and user_id=auth.uid()) then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,9463));
 insert into private.staff_unlock_attempts(user_id) values(auth.uid()) on conflict do nothing;
 select * into strict attempts from private.staff_unlock_attempts where user_id=auth.uid() for update;
 if attempts.locked_until>now() then return false;end if;
 select encrypted_password into password_hash from auth.users where id=auth.uid();
 if password_hash is null or password_hash='' or password_hash not like '$2%' then return false;end if;
 if account_password is null or octet_length(account_password)>72 or extensions.crypt(account_password,password_hash)<>password_hash then
  update private.staff_unlock_attempts set
   failures=case when locked_until<=now() then 1 else failures+1 end,
   locked_until=case when locked_until<=now() then null when failures+1>=5 then now()+interval '15 minutes' else null end
  where user_id=auth.uid();
  return false;
 end if;
 update private.staff_unlock_attempts set failures=0,locked_until=null where user_id=auth.uid();
 insert into private.staff_sessions(session_id,user_id,password_version,expires_at)
 values(sid,auth.uid(),md5(password_hash),now()+interval '15 minutes')
 on conflict(session_id) do update set password_version=excluded.password_version,expires_at=excluded.expires_at;
 return true;
end;
$$;
create function public.lock_staff() returns void
language sql security definer set search_path='' as $$
 delete from private.staff_sessions where user_id=auth.uid() and session_id=(auth.jwt()->>'session_id')::uuid;
$$;
revoke all on function public.staff_access(),public.unlock_staff(text),public.lock_staff() from public,anon;
grant execute on function public.staff_access(),public.unlock_staff(text),public.lock_staff() to authenticated;

create policy staff_directory_unlock on public.staff as restrictive for select to authenticated
 using (id=auth.uid()::text or public.staff_access());
create policy staff_insert_unlock on public.staff as restrictive for insert to authenticated
 with check (public.staff_access());
create policy staff_update_unlock on public.staff as restrictive for update to authenticated
 using (public.staff_access()) with check (public.staff_access());
create policy staff_delete_unlock on public.staff as restrictive for delete to authenticated
 using (public.staff_access());

create function public.protect_own_staff_access() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and new.id is distinct from old.id then raise exception 'Staff account ID cannot be changed';end if;
 if old.id=auth.uid()::text then
  if tg_op='DELETE' then raise exception 'You cannot remove your own staff access';end if;
  if new.role is distinct from old.role or (new.deleted and not old.deleted) then
   raise exception 'You cannot change your own role or remove your own staff access';
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end;
$$;
create trigger protect_own_staff_access before update or delete on public.staff for each row execute function public.protect_own_staff_access();

create or replace function public.set_payment_access(staff_id uuid, new_password text, allow_access boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if public.staff_role() is distinct from 'SUPER ADMIN' then raise exception 'Super admin access required';end if;
 if not public.staff_access() then raise exception 'Unlock Staff before changing payment permissions';end if;
 if not exists(select 1 from public.staff where id=staff_id::text and not deleted) then raise exception 'Staff account not found';end if;
 if allow_access and (new_password is null or length(new_password)<7 or octet_length(new_password)>72) then
  raise exception 'Use a separate payment password: at least 7 characters, at most 72 bytes';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(staff_id::text,9462));
 delete from private.payment_sessions where user_id=staff_id;
 if allow_access then
  insert into private.payment_credentials(user_id,password_hash) values(staff_id,extensions.crypt(new_password,extensions.gen_salt('bf',12)))
  on conflict(user_id) do update set password_hash=excluded.password_hash,enabled=true,failures=0,locked_until=null,changed_at=now();
 else
  update private.payment_credentials set enabled=false,changed_at=now() where user_id=staff_id;
 end if;
end;
$$;
commit;
