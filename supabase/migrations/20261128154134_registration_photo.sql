-- Photos stay inside the existing staff-protected registration and member records.
begin;
alter table public.registration_requests add column photo text not null default '';

do $$
declare definition text; updated text; signature text;
begin
 definition=pg_get_functiondef('public.submit_registration(text,jsonb)'::regprocedure);
 updated=replace(definition,'octet_length(details::text)>8192','octet_length((details - ''photo'')::text)>8192');
 if updated=definition then raise exception 'Registration size validation not found';end if;
 definition=updated;
 updated=replace(definition,' if coalesce((details->>''consent'')', $validation$
 if length(coalesce(details->>'photo',''))>140000 or coalesce(details->>'photo','') !~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/]*={0,2}$' then
  raise exception 'Upload a clear photo of yourself';
 end if;
 begin
  if right(encode(decode(substr(details->>'photo',24),'base64'),'hex'),4)<>'ffd9' then raise exception 'Invalid JPEG';end if;
 exception when others then raise exception 'Choose a valid photo and upload it again';end;
 if coalesce((details->>'consent')$validation$);
 if updated=definition then raise exception 'Registration consent validation not found';end if;
 definition=updated;
 updated=replace(definition,'notes,"formAnswers")','notes,"formAnswers",photo)');
 if updated=definition then raise exception 'Registration insert columns not found';end if;
 definition=updated;
 updated=replace(definition,'answers) returning id','answers,details->>''photo'') returning id');
 if updated=definition then raise exception 'Registration insert values not found';end if;
 execute updated;

 -- Preserve all current payment, expiry and access checks in both approval paths.
 foreach signature in array array[
  'public.approve_registration(uuid,text,date,numeric,text,text)',
  'public.approve_registration_memberships(uuid,jsonb,text,text)'
 ] loop
  definition=pg_get_functiondef(signature::regprocedure);
  updated=replace(definition,'r."branchId",'''','''',r.notes','r."branchId",r.photo,'''',r.notes');
  if updated=definition then raise exception 'Member photo insert not found in %',signature;end if;
  execute updated;
 end loop;
end $$;
commit;
