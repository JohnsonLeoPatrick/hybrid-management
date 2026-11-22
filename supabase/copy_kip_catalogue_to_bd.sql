-- Copy the current KIP catalogue once. Existing copies and all member records remain intact.
begin;
do $$
declare source_id text;destination_id text;
begin
 select id into strict source_id from public.branches where name='hybrid@KIP' and not deleted;
 select id into strict destination_id from public.branches where name='Hybrid BD' and not deleted;
 if source_id=destination_id then raise exception 'Choose distinct branches';end if;
 insert into public.classes(id,name,coach,"branchId",day,start,"end",capacity)
 select 'copy-'||destination_id||'-'||id,name,coach,destination_id,day,start,"end",capacity
 from public.classes where "branchId"=source_id and not deleted
 on conflict(id) do nothing;
 insert into public.membership_plans(id,name,months,price,description,"branchId",classes,active)
 select 'copy-'||destination_id||'-'||p.id,p.name,p.months,p.price,p.description,destination_id,
 array(select 'copy-'||destination_id||'-'||c from unnest(p.classes) c),p.active
 from public.membership_plans p where p."branchId"=source_id and not p.deleted
 on conflict(id) do nothing;
end$$;
commit;
