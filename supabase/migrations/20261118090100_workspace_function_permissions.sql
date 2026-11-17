-- This project grants some function privileges directly through default privileges.
revoke all on function public.search_members(text,text) from anon;
revoke all on function public.apply_changes_checked(jsonb,jsonb) from anon;
