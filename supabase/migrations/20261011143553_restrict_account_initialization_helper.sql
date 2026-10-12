-- Internal account initialization accepts a target user ID and must not be a client RPC.
-- Signup and ensure_default_account execute it as their postgres SECURITY DEFINER owner.
revoke all on function public.ensure_account_for_user(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.ensure_account_for_user(uuid, text, text, text) to service_role;

-- Trigger execution remains available to its owner; clients cannot call the trigger function.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- The client entry point derives identity exclusively from auth.uid().
revoke all on function public.ensure_default_account() from public, anon;
grant execute on function public.ensure_default_account() to authenticated;

notify pgrst, 'reload schema';
