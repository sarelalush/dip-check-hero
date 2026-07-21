alter table public.strip_analysis_requests
  add column if not exists provider_call_count integer not null default 0,
  add column if not exists provider_started_at timestamptz,
  add column if not exists provider_completed_at timestamptz;

alter table public.strip_analysis_requests
  drop constraint if exists strip_analysis_requests_provider_call_count_check;

alter table public.strip_analysis_requests
  add constraint strip_analysis_requests_provider_call_count_check
  check (provider_call_count between 0 and 1);

create or replace function public.claim_strip_analysis_request(
  p_user_id uuid,
  p_test_id text,
  p_account_id uuid,
  p_image_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
  v_request public.strip_analysis_requests%rowtype;
begin
  insert into public.strip_analysis_requests (
    user_id,
    test_id,
    account_id,
    image_key,
    status,
    lease_expires_at
  )
  values (
    p_user_id,
    p_test_id,
    p_account_id,
    p_image_key,
    'processing',
    now() + interval '24 hours'
  )
  on conflict (user_id, test_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    return jsonb_build_object('claimed', true, 'status', 'processing');
  end if;

  select *
  into v_request
  from public.strip_analysis_requests
  where user_id = p_user_id and test_id = p_test_id
  for update;

  if v_request.image_key <> p_image_key then
    return jsonb_build_object('claimed', false, 'status', 'conflict');
  end if;

  if v_request.status = 'completed' then
    return jsonb_build_object(
      'claimed', false,
      'status', 'completed',
      'result', v_request.result
    );
  end if;

  -- A scan ID is immutable and never reclaimed. Retrying requires a new scan ID.
  return jsonb_build_object(
    'claimed', false,
    'status', v_request.status,
    'errorCode', v_request.error_code,
    'errorMessage', v_request.error_message
  );
end;
$$;

create or replace function public.begin_strip_analysis_provider_call(
  p_user_id uuid,
  p_test_id text,
  p_image_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer := 0;
begin
  update public.strip_analysis_requests
  set
    provider_call_count = 1,
    provider_started_at = now(),
    updated_at = now()
  where user_id = p_user_id
    and test_id = p_test_id
    and image_key = p_image_key
    and status = 'processing'
    and provider_call_count = 0;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.begin_strip_analysis_provider_call(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.begin_strip_analysis_provider_call(uuid, text, text)
  to service_role;
