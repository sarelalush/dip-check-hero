import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.0';

type ProductId = 'basic_monthly' | 'extra_pool_monthly' | 'extra_scan_pack_200';

interface VerifyPurchaseRequest {
  accountId?: string;
  platform?: 'android';
  productId?: ProductId;
  purchase?: Record<string, unknown>;
  purchaseToken?: string;
}

interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
}

const ANDROID_PACKAGE_NAME = Deno.env.get('ANDROID_PACKAGE_NAME') ?? 'com.stickcheck.app';
const SCAN_PACK_PRODUCT_ID: ProductId = 'extra_scan_pack_200';
const BASIC_PRODUCT_ID: ProductId = 'basic_monthly';
const EXTRA_POOL_PRODUCT_ID: ProductId = 'extra_pool_monthly';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function json(body: unknown, status = 200) {
  return Response.json(body, { headers: corsHeaders, status });
}

function getAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service environment is not configured.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization') ?? '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7) : undefined;
}

function getGoogleServiceAccount(): GoogleServiceAccount {
  const raw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  if (!raw) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON secret is missing.');
  }

  const parsed = JSON.parse(raw) as Partial<GoogleServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON must contain client_email and private_key.');
  }

  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, '\n'),
  };
}

function base64Url(bytes: Uint8Array | string) {
  const raw = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function createGoogleAccessToken() {
  const account = getGoogleServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
      iss: account.client_email,
      scope: GOOGLE_SCOPE,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(account.private_key),
    { hash: 'SHA-256', name: 'RSASSA-PKCS1-v1_5' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const assertion = `${signingInput}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    body: new URLSearchParams({
      assertion,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token request failed (${response.status}).`);
  }

  const data = await response.json();
  if (typeof data.access_token !== 'string') {
    throw new Error('Google OAuth token response did not include an access token.');
  }

  return data.access_token as string;
}

async function googleApiGet(path: string, accessToken: string) {
  const response = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Google Play verification failed (${response.status}): ${JSON.stringify(data)}`);
  }
  return data as Record<string, unknown>;
}

async function verifyGooglePurchase(productId: ProductId, purchaseToken: string) {
  const accessToken = await createGoogleAccessToken();
  const encodedPackage = encodeURIComponent(ANDROID_PACKAGE_NAME);
  const encodedProduct = encodeURIComponent(productId);
  const encodedToken = encodeURIComponent(purchaseToken);

  if (productId === SCAN_PACK_PRODUCT_ID) {
    const data = await googleApiGet(
      `applications/${encodedPackage}/purchases/products/${encodedProduct}/tokens/${encodedToken}`,
      accessToken,
    );
    if (data.purchaseState !== 0) {
      throw new Error('Google Play product purchase is not completed.');
    }
    return {
      currentPeriodEnd: null as string | null,
      currentPeriodStart: null as string | null,
      raw: data,
      status: 'completed',
      type: 'in_app',
    };
  }

  const data = await googleApiGet(
    `applications/${encodedPackage}/purchases/subscriptionsv2/tokens/${encodedToken}`,
    accessToken,
  );
  const state = String(data.subscriptionState ?? '');
  const activeStates = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD']);
  if (!activeStates.has(state)) {
    throw new Error(`Google Play subscription is not active (${state || 'unknown'}).`);
  }

  const lineItems = Array.isArray(data.lineItems) ? data.lineItems : [];
  const firstLineItem = (lineItems[0] ?? {}) as Record<string, unknown>;
  return {
    currentPeriodEnd: typeof firstLineItem.expiryTime === 'string' ? firstLineItem.expiryTime : null,
    currentPeriodStart: typeof data.startTime === 'string' ? data.startTime : null,
    raw: data,
    status: 'active',
    type: 'subscription',
  };
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    endDate: end.toISOString().slice(0, 10),
    endIso: end.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    startIso: start.toISOString(),
  };
}

async function ensureMembership(supabase: ReturnType<typeof getAdminClient>, accountId: string, userId: string) {
  const { data, error } = await supabase
    .from('account_members')
    .select('id')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('User is not a member of this account.');
}

async function getActiveBaseSubscriptionId(supabase: ReturnType<typeof getAdminClient>, accountId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('account_id', accountId)
    .eq('plan_id', BASIC_PRODUCT_ID)
    .in('status', ['trialing', 'active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined;
}

async function refreshUsage(supabase: ReturnType<typeof getAdminClient>, accountId: string) {
  const { data, error } = await supabase.rpc('refresh_usage_period', { p_account_id: accountId });
  if (error) throw error;
  return data;
}

async function processVerifiedPurchase(
  supabase: ReturnType<typeof getAdminClient>,
  body: Required<Pick<VerifyPurchaseRequest, 'accountId' | 'productId' | 'purchaseToken'>>,
  verification: Awaited<ReturnType<typeof verifyGooglePurchase>>,
) {
  const providerEventId = `${body.productId}:${body.purchaseToken}`;
  const { data: existingEvent, error: existingError } = await supabase
    .from('billing_events')
    .select('id,processed')
    .eq('provider', 'google_play')
    .eq('provider_event_id', providerEventId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingEvent?.processed) {
    const usage = await refreshUsage(supabase, body.accountId);
    return { alreadyProcessed: true, usage };
  }

  const { error: eventError } = await supabase.from('billing_events').upsert(
    {
      account_id: body.accountId,
      event_type: 'purchase_verified',
      payload: {
        google: verification.raw,
        productId: body.productId,
        purchaseToken: body.purchaseToken,
      },
      processed: false,
      provider: 'google_play',
      provider_event_id: providerEventId,
    },
    { onConflict: 'provider,provider_event_id' },
  );
  if (eventError) throw eventError;

  if (body.productId === BASIC_PRODUCT_ID) {
    const { error } = await supabase.from('subscriptions').insert({
      account_id: body.accountId,
      current_period_end: verification.currentPeriodEnd,
      current_period_start: verification.currentPeriodStart,
      plan_id: BASIC_PRODUCT_ID,
      provider: 'google_play',
      provider_subscription_id: body.purchaseToken,
      status: 'active',
    });
    if (error) throw error;
  } else {
    const subscriptionId = await getActiveBaseSubscriptionId(supabase, body.accountId);
    if (!subscriptionId) {
      throw new Error('A base subscription is required before purchasing add-ons.');
    }

    if (body.productId === EXTRA_POOL_PRODUCT_ID) {
      const { error } = await supabase.from('subscription_addons').insert({
        account_id: body.accountId,
        addon_id: EXTRA_POOL_PRODUCT_ID,
        current_period_end: verification.currentPeriodEnd,
        current_period_start: verification.currentPeriodStart,
        quantity: 1,
        status: 'active',
        subscription_id: subscriptionId,
      });
      if (error) throw error;
    }

    if (body.productId === SCAN_PACK_PRODUCT_ID) {
      const range = currentMonthRange();
      const { error } = await supabase.from('subscription_addons').insert({
        account_id: body.accountId,
        addon_id: SCAN_PACK_PRODUCT_ID,
        current_period_end: range.endIso,
        current_period_start: range.startIso,
        quantity: 1,
        status: 'active',
        subscription_id: subscriptionId,
      });
      if (error) throw error;
    }
  }

  const usage = await refreshUsage(supabase, body.accountId);
  const { error: processedError } = await supabase
    .from('billing_events')
    .update({ processed: true })
    .eq('provider', 'google_play')
    .eq('provider_event_id', providerEventId);
  if (processedError) throw processedError;

  return { alreadyProcessed: false, usage };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = (await request.json()) as VerifyPurchaseRequest;
    if (body.platform !== 'android') return json({ error: 'unsupported_platform' }, 400);
    if (!body.accountId || !body.productId || !body.purchaseToken) {
      return json({ error: 'missing_purchase_fields' }, 400);
    }

    if (![BASIC_PRODUCT_ID, EXTRA_POOL_PRODUCT_ID, SCAN_PACK_PRODUCT_ID].includes(body.productId)) {
      return json({ error: 'unsupported_product' }, 400);
    }

    const supabase = getAdminClient();
    const token = getBearerToken(request);
    if (!token) return json({ error: 'missing_auth' }, 401);

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'invalid_auth' }, 401);

    await ensureMembership(supabase, body.accountId, userData.user.id);
    const verification = await verifyGooglePurchase(body.productId, body.purchaseToken);
    const result = await processVerifiedPurchase(supabase, {
      accountId: body.accountId,
      productId: body.productId,
      purchaseToken: body.purchaseToken,
    }, verification);

    return json({
      ok: true,
      alreadyProcessed: result.alreadyProcessed,
      productId: body.productId,
      usage: result.usage,
    });
  } catch (error) {
    console.error('verify-google-play-purchase failed', error);
    return json(
      {
        error: 'purchase_verification_failed',
        message: error instanceof Error ? error.message : 'Purchase verification failed.',
        ok: false,
      },
      400,
    );
  }
});
