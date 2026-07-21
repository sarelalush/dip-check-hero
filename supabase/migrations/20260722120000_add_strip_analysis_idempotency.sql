create table if not exists public.strip_analysis_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  test_id text not null,
  account_id uuid references public.accounts(id) on delete cascade,
  image_key text not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  result jsonb,
  error_code text,
  error_message text,
  lease_expires_at timestamptz not null default (now() + interval '2 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, test_id)
);

alter table public.strip_analysis_requests enable row level security;

create index if not exists strip_analysis_requests_created_at_idx
  on public.strip_analysis_requests (created_at);

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
    now() + interval '2 minutes'
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

  if v_request.status in ('processing', 'failed') and v_request.lease_expires_at <= now() then
    update public.strip_analysis_requests
    set
      account_id = p_account_id,
      status = 'processing',
      result = null,
      error_code = null,
      error_message = null,
      lease_expires_at = now() + interval '2 minutes',
      updated_at = now()
    where user_id = p_user_id and test_id = p_test_id;

    return jsonb_build_object('claimed', true, 'status', 'processing');
  end if;

  return jsonb_build_object(
    'claimed', false,
    'status', v_request.status,
    'errorCode', v_request.error_code,
    'errorMessage', v_request.error_message
  );
end;
$$;

revoke all on table public.strip_analysis_requests from anon, authenticated;
revoke all on function public.claim_strip_analysis_request(uuid, text, uuid, text) from public, anon, authenticated;
grant all on table public.strip_analysis_requests to service_role;
grant execute on function public.claim_strip_analysis_request(uuid, text, uuid, text) to service_role;
