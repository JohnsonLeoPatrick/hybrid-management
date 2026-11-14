-- Supabase's default grants can include anon and authenticated explicitly.
revoke all on function public.member_number_reusable(text) from public, anon, authenticated;
revoke all on function public.allocate_membership_number(text,text) from public, anon, authenticated;
revoke all on function public.assign_membership_number() from public, anon, authenticated;
revoke all on function public.ensure_renewal_member_number() from public, anon, authenticated;
