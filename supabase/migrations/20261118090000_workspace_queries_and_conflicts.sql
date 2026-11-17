-- Invoker functions retain table privileges and row-level security.
create function public.search_members(search_text text, branch_filter text default null)
returns table(id text) language sql stable security invoker set search_path=public as $$
 select m.id from public.members m
 where not m.deleted and (branch_filter is null or m."branchId"=branch_filter)
 and (strpos(lower(m.name),lower(trim(search_text)))>0
   or strpos(lower(m.id),lower(trim(search_text)))>0
   or strpos(lower(coalesce(m.email,'')),lower(trim(search_text)))>0
   or strpos(lower(coalesce(m.ic,'')),lower(trim(search_text)))>0
   or strpos(coalesce(m.phone,''),trim(search_text))>0
   or (regexp_replace(search_text,'[^0-9]','','g')<>'' and
       regexp_replace(search_text,'[^0-9]','','g')=trim(search_text) and
       strpos(regexp_replace(coalesce(m.phone,''),'[^0-9]','','g'),trim(search_text))>0)
   or lpad(coalesce(m."membershipNumber"::text,''),greatest(2,length(coalesce(m."membershipNumber"::text,''))),'0')=trim(search_text))
 order by m.id;
$$;
revoke all on function public.search_members(text,text) from public;
grant execute on function public.search_members(text,text) to authenticated;

create function public.apply_changes_checked(changes jsonb, deletions jsonb default '[]'::jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare item jsonb; tbl text; actual jsonb;
begin
 if public.staff_role() is null then raise exception 'Staff access required'; end if;
 -- Match the existing writer's lock order before locking individual records.
 perform pg_advisory_xact_lock(824312);
 for item in select value from jsonb_array_elements(changes || deletions) order by value->>'table',value->>'id' loop
  tbl=item->>'table';
  if tbl not in ('branches','staff','classes','membership_plans','members','memberships','payments','membership_renewals','attendance') then
   raise exception 'Invalid table';
  end if;
  execute format('select to_jsonb(r) from public.%I r where id=$1 for update',tbl) into actual using item->>'id';
  if coalesce((item->>'isNew')::boolean,false) then
   if actual is not null then raise exception 'Record ID already exists. Refresh and retry.'; end if;
  else
   if jsonb_typeof(item->'expected') is distinct from 'object' then raise exception 'Previous record required'; end if;
   if actual is null or not (actual @> (item->'expected')) then
    raise exception using errcode='40001', message='This record changed since you opened it. Refresh the workspace and review your changes before saving again.';
   end if;
  end if;
 end loop;
 perform public.apply_changes(changes,deletions);
end $$;
revoke all on function public.apply_changes_checked(jsonb,jsonb) from public;
grant execute on function public.apply_changes_checked(jsonb,jsonb) to authenticated;
