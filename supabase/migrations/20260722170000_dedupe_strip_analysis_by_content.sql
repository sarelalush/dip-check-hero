alter table public.strip_analysis_requests
  add column if not exists content_key text;

create unique index if not exists strip_analysis_requests_user_content_key_idx
  on public.strip_analysis_requests (user_id, content_key)
  where content_key is not null;

create or replace function public.claim_strip_analysis_content(
  p_user_id uuid,
  p_test_id text,
  p_account_id uuid,
  p_image_key text,
  p_content_key text
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
    content_key,
    status,
    lease_expires_at
  )
  values (
    p_user_id,
    p_test_id,
    p_account_id,
    p_image_key,
    p_content_key,
    'processing',
    now() + interval '24 hours'
  )
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    return jsonb_build_object(
      'claimed', true,
      'status', 'processing',
      'canonicalTestId', p_test_id
    );
  end if;

  select *
  into v_request
  from public.strip_analysis_requests
  where user_id = p_user_id and test_id = p_test_id;

  if found and v_request.content_key is distinct from p_content_key then
    return jsonb_build_object(
      'claimed', false,
      'status', 'conflict',
      'canonicalTestId', v_request.test_id
    );
  end if;

  if not found then
    select *
    into v_request
    from public.strip_analysis_requests
    where user_id = p_user_id and content_key = p_content_key
    order by created_at
    limit 1;
  end if;

  if not found then
    return jsonb_build_object('claimed', false, 'status', 'conflict');
  end if;

  if v_request.status = 'completed' then
    return jsonb_build_object(
      'claimed', false,
      'status', 'completed',
      'canonicalTestId', v_request.test_id,
      'result', v_request.result
    );
  end if;

  return jsonb_build_object(
    'claimed', false,
    'status', v_request.status,
    'canonicalTestId', v_request.test_id,
    'errorCode', v_request.error_code,
    'errorMessage', v_request.error_message
  );
end;
$$;

revoke all on function public.claim_strip_analysis_content(uuid, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_strip_analysis_content(uuid, text, uuid, text, text)
  to service_role;
