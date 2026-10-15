-- Apply after schema.sql, including on existing installations.
-- Unlisted class end times remain NULL. Capacity is an editable operational default.
begin;
alter table public.classes alter column "end" drop not null;
insert into public.classes(id,name,coach,"branchId",day,start,"end",capacity) values
 ('c2','Boxing','Coach Farouqi (IBA Referee & RMAF Coach)','dd','Monday','20:00',null,24),
 ('kickboxing-tue','Kickboxing','To be assigned','dd','Tuesday','20:30',null,24),
 ('kickboxing-sat','Kickboxing','To be assigned','dd','Saturday','10:15',null,24),
 ('jkd-tue','Jeet Kune Do & Kali','Master Eric Khoo (7th Dan ITF / JKD Expert)','dd','Tuesday','18:00',null,24),
 ('c3','Mixed Martial Arts (MMA)','Coach Ray (SEA Games Wrestling Gold Medallist)','dd','Wednesday','19:00',null,24),
 ('c1','Muay Thai','To be assigned','dd','Friday','19:30',null,24),
 ('tkd-thu','Tae Kwon Do (ITF) - Kids','To be assigned','dd','Thursday','17:00',null,24),
 ('tkd-sat','Tae Kwon Do (ITF)','To be assigned','dd','Saturday','10:15',null,24),
 ('bjj-sun','Brazilian Jiu-Jitsu','Professor Azrai (15+ Years BJJ Mastery)','dd','Sunday','09:30',null,24)
on conflict(id) do update set name=excluded.name,coach=excluded.coach,day=excluded.day,start=excluded.start;

-- This migration is run by the database owner. Plan-link validation relies on staff-readable classes.
-- Existing trigger runs with the owner here; it does not require an authenticated staff session.
insert into public.membership_plans(id,name,months,price,description,"branchId",classes,active) values
 ('hybrid-boxing','Boxing',1,170,'Monday 8:00 PM - Coach Farouqi','dd',array['c2'],true),
 ('hybrid-kickboxing','Kickboxing',1,170,'Tuesday 8:30 PM & Saturday 10:15 AM - Striking technique, agility & conditioning','dd',array['kickboxing-tue','kickboxing-sat'],true),
 ('hybrid-jkd','Jeet Kune Do & Kali',1,190,'Tuesday 6:00 PM - Master Eric Khoo','dd',array['jkd-tue'],true),
 ('hybrid-mma','Mixed Martial Arts (MMA)',1,170,'Wednesday 7:00 PM - Coach Ray','dd',array['c3'],true),
 ('hybrid-muay-thai','Muay Thai',1,170,'Friday 7:30 PM - Clinch work, power kicks, pad work & stamina','dd',array['c1'],true),
 ('hybrid-tkd','Tae Kwon Do (ITF)',1,170,'Thursday 5:00 PM (Kids) / Saturday 10:15 AM - Forms, precision sparring & discipline','dd',array['tkd-thu','tkd-sat'],true),
 ('hybrid-bjj','Brazilian Jiu-Jitsu',1,170,'Sunday 9:30 AM - Professor Azrai','dd',array['bjj-sun'],true)
on conflict(id) do update set price=excluded.price,months=excluded.months;
-- Body Building and Arm Wrestling have no advertised price, so no zero-priced plan is created.
create or replace function public.apply_changes(changes jsonb, deletions jsonb default '[]'::jsonb) returns void language plpgsql security invoker set search_path=public as $$
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

commit;
