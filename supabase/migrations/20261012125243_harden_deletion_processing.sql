-- Preparing the deletion workflow does not authorize or start a deletion.
alter table public.account_deletion_requests
  add column review_required boolean not null default true,
  add column approved_at timestamptz,
  add column approved_by uuid references auth.users(id) on delete set null,
  add column approval_note text,
  add column approved_scope jsonb,
  add column attempt_count integer not null default 0 check(attempt_count>=0),
  add column lease_token uuid,
  add column lease_expires_at timestamptz,
  add column storage_removed_at timestamptz,
  add column identity_removed_at timestamptz;

create or replace function private.admin_deletion_queue()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.is_current_user_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'status',r.status,'requestedAt',r.requested_at,'reviewRequired',r.review_required,
      'approvedAt',r.approved_at,'attemptCount',r.attempt_count,'operatorNote',r.operator_note,
      'leaseExpired',r.status='processing' and r.lease_expires_at<now()) order by r.requested_at)
    from public.account_deletion_requests r where status<>'completed'),'[]'::jsonb);
end; $$;
create function public.admin_deletion_queue() returns jsonb
language sql security invoker set search_path='' as $$ select private.admin_deletion_queue() $$;
revoke all on function private.admin_deletion_queue(),public.admin_deletion_queue() from public,anon;
grant execute on function private.admin_deletion_queue(),public.admin_deletion_queue() to authenticated;

create or replace function private.approve_account_deletion(p_request_id uuid,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.account_deletion_requests%rowtype; scope jsonb;
begin
  if not public.is_current_user_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
  if not exists(select 1 from public.service_release_config where id and retention_policy_completed) then
    raise exception 'retention_policy_review_required';
  end if;
  if length(trim(coalesce(p_note,'')))<20 or length(p_note)>2000 then raise exception 'documented_review_required'; end if;
  select * into r from public.account_deletion_requests where id=p_request_id for update;
  if r.id is null or r.status<>'pending' or r.user_id is null then raise exception 'request_not_pending'; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.user_id::text,1));
  if exists(select 1 from public.account_members m join public.accounts a on a.id=m.account_id
      where m.user_id=r.user_id and a.owner_user_id<>r.user_id)
    or exists(select 1 from public.accounts a join public.account_members m on m.account_id=a.id
      where a.owner_user_id=r.user_id and m.user_id<>r.user_id) then
    raise exception 'shared_account_manual_review_required';
  end if;
  select coalesce(jsonb_agg(a.id order by a.id),'[]'::jsonb) into scope
    from public.accounts a where a.owner_user_id=r.user_id;
  update public.account_deletion_requests set approved_at=now(),approved_by=auth.uid(),
    approval_note=trim(p_note),approved_scope=scope,review_required=false,operator_note=null where id=r.id;
  return jsonb_build_object('id',r.id,'approved',true);
end; $$;
create function public.approve_account_deletion(p_request_id uuid,p_note text) returns jsonb
language sql security invoker set search_path='' as $$ select private.approve_account_deletion(p_request_id,p_note) $$;
revoke all on function private.approve_account_deletion(uuid,text),public.approve_account_deletion(uuid,text) from public,anon;
grant execute on function private.approve_account_deletion(uuid,text),public.approve_account_deletion(uuid,text) to authenticated;

create or replace function private.claim_account_deletion(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.account_deletion_requests%rowtype;
begin
  if not private.is_internal_service() then raise exception 'server_only' using errcode='42501'; end if;
  if not exists(select 1 from public.service_release_config where id and retention_policy_completed) then
    raise exception 'retention_policy_review_required';
  end if;
  select * into r from public.account_deletion_requests where id=p_request_id for update;
  if r.id is null or r.status='completed' or r.review_required or r.approved_at is null
    or r.approved_scope is null or r.attempt_count>=5
    or (r.status='processing' and r.lease_expires_at>now()) then raise exception 'operator_review_required'; end if;
  update public.account_deletion_requests set status='processing',attempt_count=attempt_count+1,
    lease_token=gen_random_uuid(),lease_expires_at=now()+interval '5 minutes',operator_note=null
    where id=r.id returning * into r;
  return jsonb_build_object('userId',r.user_id,'accountIds',r.approved_scope,'leaseToken',r.lease_token,
    'storageRemovedAt',r.storage_removed_at,'identityRemovedAt',r.identity_removed_at);
end; $$;
create function public.claim_account_deletion(p_request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.claim_account_deletion(p_request_id) $$;
revoke all on function private.claim_account_deletion(uuid),public.claim_account_deletion(uuid) from public,anon,authenticated;
grant execute on function private.claim_account_deletion(uuid),public.claim_account_deletion(uuid) to service_role;

notify pgrst,'reload schema';
