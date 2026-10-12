CREATE OR REPLACE FUNCTION private.claim_strip_analysis_content(p_user_id uuid, p_test_id text, p_account_id uuid, p_image_key text, p_content_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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


  -- Only requests made under the deployed provider-call guard are eligible.
  -- A started paid call is never reset, including on a provider failure.
  if v_request.created_at >= timestamptz '2026-10-12T13:02:31Z'
    and v_request.provider_call_count=0 and v_request.provider_started_at is null
    and (v_request.status='failed'
      or (v_request.status='processing' and v_request.lease_expires_at<=now())) then
    update public.strip_analysis_requests set
      status='processing',image_key=p_image_key,error_code=null,error_message=null,
      lease_expires_at=now()+interval '24 hours',updated_at=now()
      where user_id=p_user_id and test_id=v_request.test_id
        and account_id=p_account_id and content_key=p_content_key
        and provider_call_count=0 and provider_started_at is null
        and (status='failed' or (status='processing' and lease_expires_at<=now()));
    get diagnostics v_inserted=row_count;
    if v_inserted=1 then
      return jsonb_build_object('claimed',true,'status','processing','canonicalTestId',v_request.test_id);
    end if;
    -- Another request won the retry. Observe its current state, not the old failure.
    select * into v_request from public.strip_analysis_requests
      where user_id=p_user_id and test_id=v_request.test_id;
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
$function$;
notify pgrst,'reload schema';
