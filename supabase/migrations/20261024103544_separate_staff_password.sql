-- Staff uses its own configured password; account login passwords are not accepted.
begin;
create table private.staff_credentials (
 user_id uuid primary key references auth.users(id) on delete cascade,
 password_hash text not null,
 enabled boolean not null default true
);
alter table private.staff_credentials enable row level security;
revoke all on private.staff_credentials from public,anon,authenticated;

create or replace function public.staff_access() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(public.staff_role()='SUPER ADMIN',false) and exists(
  select 1 from private.staff_sessions p
  join auth.sessions s on s.id=p.session_id and s.user_id=p.user_id
  join private.staff_credentials c on c.user_id=p.user_id and c.enabled
  join auth.users u on u.id=p.user_id and md5(c.password_hash||'/'||coalesce(u.encrypted_password,''))=p.password_version
  where p.user_id=auth.uid() and p.session_id=(auth.jwt()->>'session_id')::uuid and p.expires_at>now()
 );
$$;

create or replace function public.unlock_staff(account_password text) returns boolean
language plpgsql security definer set search_path='' as $$
declare sid uuid; password_hash text; login_hash text; attempts private.staff_unlock_attempts;
begin
 if public.staff_role() is distinct from 'SUPER ADMIN' then return false;end if;
 sid=(auth.jwt()->>'session_id')::uuid;
 if sid is null or not exists(select 1 from auth.sessions where id=sid and user_id=auth.uid()) then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,9463));
 insert into private.staff_unlock_attempts(user_id) values(auth.uid()) on conflict do nothing;
 select * into strict attempts from private.staff_unlock_attempts where user_id=auth.uid() for update;
 if attempts.locked_until>now() then return false;end if;
 select c.password_hash,u.encrypted_password into password_hash,login_hash
 from private.staff_credentials c join auth.users u on u.id=c.user_id
 where c.user_id=auth.uid() and c.enabled;
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
 values(sid,auth.uid(),md5(password_hash||'/'||coalesce(login_hash,'')),now()+interval '15 minutes')
 on conflict(session_id) do update set password_version=excluded.password_version,expires_at=excluded.expires_at;
 return true;
end;
$$;

-- Keep the existing RPC parameter name for compatibility with earlier clients.
revoke all on function public.staff_access(),public.unlock_staff(text) from public,anon;
grant execute on function public.staff_access(),public.unlock_staff(text) to authenticated;
commit;
