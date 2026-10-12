-- A scan rejected for confidence/evidence is not billed. This matches the
-- previous mobile policy, now evaluated against the server completion record.
create or replace function private.analysis_is_billable(p_result jsonb) returns boolean
language sql immutable security invoker set search_path='' as $$
  select p_result is not null and coalesce((p_result->>'accepted')::boolean,true)
    and coalesce((p_result->>'isValidStrip')::boolean,true)
    and not coalesce((p_result->>'lowConfidence')::boolean,false)
    and coalesce(p_result->>'failureReason','none')='none';
$$;
revoke all on function private.analysis_is_billable(jsonb) from public,anon,authenticated;
grant execute on function private.analysis_is_billable(jsonb) to service_role;

create or replace function private.register_scan_usage(p_account_id uuid,p_user_id uuid,p_test_id uuid)
returns public.usage_periods language plpgsql security definer set search_path='' as $$
declare v_usage public.usage_periods%rowtype; v_result jsonb;
begin
  if not private.is_internal_service() then
    raise exception 'server_only' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 2));
  if not exists(select 1 from public.tests where id=p_test_id
      and account_id=p_account_id and user_id=p_user_id) then
    raise exception 'test_scope_mismatch' using errcode='42501';
  end if;
  select result into v_result from public.strip_analysis_requests
    where user_id=p_user_id and test_id=p_test_id::text
      and account_id=p_account_id and status='completed' and provider_call_count=1;
  if v_result is null then raise exception 'analysis_not_completed'; end if;
  v_usage := public.refresh_usage_period(p_account_id);
  -- Billability comes from the server's completion record, never client tests.
  if not private.analysis_is_billable(v_result) then return v_usage; end if;
  if not exists(select 1 from public.usage_events
      where account_id=p_account_id and test_id=p_test_id and event_type='scan') then
    insert into public.usage_events(account_id,user_id,test_id,event_type,quantity,billable,period_start)
      values(p_account_id,p_user_id,p_test_id,'scan',1,true,v_usage.period_start);
  end if;
  return public.refresh_usage_period(p_account_id);
end; $$;
create index if not exists usage_events_scan_lookup
  on public.usage_events(account_id,test_id) where event_type='scan';

-- Reserve quota under the same account lock used by usage registration.
-- Count in-flight and completed-but-not-yet-registered provider calls so
-- simultaneous requests cannot all consume the final available scan.
create or replace function private.begin_strip_analysis_provider_call(p_user_id uuid,p_test_id text,p_image_key text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_account uuid; v_usage public.usage_periods%rowtype; v_reserved integer; v_updated integer;
begin
  if not private.is_internal_service() then raise exception 'server_only' using errcode='42501'; end if;
  select account_id into v_account from public.strip_analysis_requests
    where user_id=p_user_id and test_id=p_test_id and image_key=p_image_key
      and status='processing' and provider_call_count=0;
  if v_account is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_account::text,2));
  if not public.can_manage_account_content(v_account,p_user_id)
    or not public.account_has_active_subscription_for_user(v_account,p_user_id) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  if (select count(*) from public.strip_analysis_requests where account_id=v_account
      and provider_started_at > now()-interval '1 minute') >= 8 then
    raise exception 'scan_rate_limited';
  end if;
  v_usage := public.refresh_usage_period(v_account);
  select count(*) into v_reserved from public.strip_analysis_requests r
    where r.account_id=v_account and r.provider_call_count=1
      and r.provider_started_at >= v_usage.period_start::timestamptz
      and (r.status='processing' and r.lease_expires_at > now()
        or r.status='completed' and private.analysis_is_billable(r.result))
      and not exists(select 1 from public.usage_events e
        where e.account_id=v_account and e.test_id::text=r.test_id and e.event_type='scan');
  if v_usage.scans_billable + v_reserved >= v_usage.scans_limit then
    raise exception 'scan_quota_exhausted';
  end if;
  update public.strip_analysis_requests set provider_call_count=1,provider_started_at=now(),updated_at=now()
    where user_id=p_user_id and test_id=p_test_id and image_key=p_image_key
      and status='processing' and provider_call_count=0;
  get diagnostics v_updated=row_count;
  return v_updated=1;
end; $$;


create or replace function private.guard_content_scope() returns trigger
language plpgsql security definer set search_path='' as $$
declare linked_account uuid;
begin
  if tg_op='UPDATE' and (new.id is distinct from old.id or new.account_id is distinct from old.account_id) then
    raise exception 'immutable_content_scope' using errcode='42501';
  end if;
  if tg_table_name='tests' then
    if tg_op='UPDATE' and new.user_id is distinct from old.user_id
      and not (new.user_id is null and not exists(select 1 from auth.users where id=old.user_id))
      and not (old.user_id is null and private.is_internal_service() and exists(
        select 1 from public.strip_analysis_requests r where r.test_id=new.id::text
          and r.account_id=new.account_id and r.user_id=new.user_id and r.status='completed')) then
      raise exception 'immutable_test_author' using errcode='42501';
    end if;
    if new.pool_id is not null then
      select account_id into linked_account from public.pools where id=new.pool_id;
      if linked_account is distinct from new.account_id then raise exception 'pool_scope_mismatch'; end if;
    end if;
  elsif tg_table_name='pools' then
    if tg_op='UPDATE' and new.owner_user_id is distinct from old.owner_user_id
      and not (new.owner_user_id is null and not exists(select 1 from auth.users where id=old.owner_user_id)) then
      raise exception 'immutable_pool_owner' using errcode='42501';
    end if;
  else
    if tg_op='UPDATE' and new.test_id is distinct from old.test_id then
      raise exception 'immutable_test_link' using errcode='42501';
    end if;
    select account_id into linked_account from public.tests where id=new.test_id;
    if linked_account is distinct from new.account_id then raise exception 'test_scope_mismatch'; end if;
  end if;
  return new;
end; $$;

notify pgrst,'reload schema';
