import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.0';

type InternalProductId = 'basic_monthly' | 'extra_pool_monthly' | 'extra_scan_pack_200';
type AppleEnvironment = 'Production' | 'Sandbox';

interface VerifyApplePurchaseRequest {
  accountId?: string;
  platform?: 'ios';
  productId?: string;
  purchase?: Record<string, unknown>;
  purchaseToken?: string;
  signedTransactionInfo?: string;
  transactionId?: string;
}

interface AppleTransactionPayload {
  bundleId?: string;
  environment?: AppleEnvironment;
  expiresDate?: number | string;
  inAppOwnershipType?: string;
  originalTransactionId?: string;
  productId?: string;
  purchaseDate?: number | string;
  quantity?: number;
  signedDate?: number | string;
  transactionId?: string;
  type?: string;
}

const APPLE_BUNDLE_ID = Deno.env.get('APPLE_BUNDLE_ID') ?? 'com.stickcheck.app';
const APPLE_ISSUER_ID = Deno.env.get('APPLE_ISSUER_ID');
const APPLE_KEY_ID = Deno.env.get('APPLE_KEY_ID');
const APPLE_PRIVATE_KEY = Deno.env.get('APPLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
const APPLE_PRODUCTION_API = 'https://api.storekit.itunes.apple.com/inApps/v1';
const APPLE_SANDBOX_API = 'https://api.storekit-sandbox.itunes.apple.com/inApps/v1';
const SCAN_PACK_PRODUCT_ID: InternalProductId = 'extra_scan_pack_200';
const BASIC_PRODUCT_ID: InternalProductId = 'basic_monthly';
const EXTRA_POOL_PRODUCT_ID: InternalProductId = 'extra_pool_monthly';
const STORE_PRODUCT_ALIASES: Record<string, InternalProductId> = {
  'basic-monthly': BASIC_PRODUCT_ID,
  basic_monthly: BASIC_PRODUCT_ID,
  'extra-pool-monthly': EXTRA_POOL_PRODUCT_ID,
  extra_pool_monthly: EXTRA_POOL_PRODUCT_ID,
  'extra-scan-pack-200': SCAN_PACK_PRODUCT_ID,
  extra_scan_pack_200: SCAN_PACK_PRODUCT_ID,
};

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

function normalizeProductId(productId: string) {
  return STORE_PRODUCT_ALIASES[productId];
}

function base64Url(bytes: Uint8Array | string) {
  const raw = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(input: string) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  return base64UrlToBytes(base64.replace(/\+/g, '-').replace(/\//g, '_')).buffer;
}

function decodeAppleTransactionJws(jws: string): AppleTransactionPayload {
  const parts = jws.split('.');
  if (parts.length < 2) throw new Error('Apple transaction payload is not a valid JWS.');
  const payloadBytes = base64UrlToBytes(parts[1]);
  return JSON.parse(new TextDecoder().decode(payloadBytes)) as AppleTransactionPayload;
}

function appleMillisToIso(value?: number | string) {
  if (value === undefined || value === null) return null;
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return new Date(numericValue).toISOString();
}

async function createAppleServerJwt() {
  if (!APPLE_ISSUER_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
    throw new Error('Apple App Store Server API secrets are missing.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: APPLE_KEY_ID, typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      aud: 'appstoreconnect-v1',
      bid: APPLE_BUNDLE_ID,
      exp: now + 900,
      iat: now,
      iss: APPLE_ISSUER_ID,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(APPLE_PRIVATE_KEY),
    { namedCurve: 'P-256', name: 'ECDSA' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign({ hash: 'SHA-256', name: 'ECDSA' }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

async function fetchAppleTransactionInfo(transactionId: string, environment: AppleEnvironment, jwt: string) {
  const baseUrl = environment === 'Sandbox' ? APPLE_SANDBOX_API : APPLE_PRODUCTION_API;
  const response = await fetch(`${baseUrl}/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Apple ${environment} verification failed (${response.status}): ${JSON.stringify(data)}`);
  }
  if (!data || typeof data.signedTransactionInfo !== 'string') {
    throw new Error(`Apple ${environment} response did not include signedTransactionInfo.`);
  }
  return data.signedTransactionInfo as string;
}

async function verifyApplePurchase(storeProductId: string, internalProductId: InternalProductId, transactionId: string, clientJws?: string) {
  const jwt = await createAppleServerJwt();
  let signedTransactionInfo = clientJws;
  let payload = signedTransactionInfo ? decodeAppleTransactionJws(signedTransactionInfo) : null;
  let lastError: unknown;

  for (const environment of ['Production', 'Sandbox'] as AppleEnvironment[]) {
    try {
      signedTransactionInfo = await fetchAppleTransactionInfo(transactionId, environment, jwt);
      payload = decodeAppleTransactionJws(signedTransactionInfo);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!payload) {
    throw lastError instanceof Error ? lastError : new Error('Apple transaction could not be verified.');
  }
  if (payload.bundleId !== APPLE_BUNDLE_ID) {
    throw new Error('Apple transaction belongs to a different bundle identifier.');
  }
  if (payload.productId !== storeProductId) {
    throw new Error('Apple transaction product does not match the requested product.');
  }
  if (payload.transactionId !== transactionId) {
    throw new Error('Apple transaction ID does not match the requested transaction.');
  }

  const currentPeriodStart = appleMillisToIso(payload.purchaseDate);
  const currentPeriodEnd = appleMillisToIso(payload.expiresDate);

  if (internalProductId !== SCAN_PACK_PRODUCT_ID) {
    if (!currentPeriodEnd || new Date(currentPeriodEnd).getTime() <= Date.now()) {
      throw new Error('Apple subscription is not active.');
    }
  }

  return {
    currentPeriodEnd,
    currentPeriodStart,
    originalTransactionId: payload.originalTransactionId ?? payload.transactionId,
    raw: payload,
    signedTransactionInfo,
    status: internalProductId === SCAN_PACK_PRODUCT_ID ? 'completed' : 'active',
    transactionId: payload.transactionId,
    type: internalProductId === SCAN_PACK_PRODUCT_ID ? 'in_app' : 'subscription',
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
  body: {
    accountId: string;
    internalProductId: InternalProductId;
    storeProductId: string;
  },
  verification: Awaited<ReturnType<typeof verifyApplePurchase>>,
) {
  const providerEventId = `${body.storeProductId}:${verification.transactionId}`;
  const { data: existingEvent, error: existingError } = await supabase
    .from('billing_events')
    .select('id,processed')
    .eq('provider', 'app_store')
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
        apple: verification.raw,
        internalProductId: body.internalProductId,
        productId: body.storeProductId,
        signedTransactionInfo: verification.signedTransactionInfo,
        transactionId: verification.transactionId,
      },
      processed: false,
      provider: 'app_store',
      provider_event_id: providerEventId,
    },
    { onConflict: 'provider,provider_event_id' },
  );
  if (eventError) throw eventError;

  if (body.internalProductId === BASIC_PRODUCT_ID) {
    const { error } = await supabase.from('subscriptions').insert({
      account_id: body.accountId,
      current_period_end: verification.currentPeriodEnd,
      current_period_start: verification.currentPeriodStart,
      plan_id: BASIC_PRODUCT_ID,
      provider: 'app_store',
      provider_subscription_id: verification.originalTransactionId,
      status: 'active',
    });
    if (error) throw error;
  } else {
    const subscriptionId = await getActiveBaseSubscriptionId(supabase, body.accountId);
    if (!subscriptionId) {
      throw new Error('A base subscription is required before purchasing add-ons.');
    }

    if (body.internalProductId === EXTRA_POOL_PRODUCT_ID) {
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

    if (body.internalProductId === SCAN_PACK_PRODUCT_ID) {
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
    .eq('provider', 'app_store')
    .eq('provider_event_id', providerEventId);
  if (processedError) throw processedError;

  return { alreadyProcessed: false, usage };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = (await request.json()) as VerifyApplePurchaseRequest;
    if (body.platform !== 'ios') return json({ error: 'unsupported_platform' }, 400);
    if (!body.accountId || !body.productId || !body.transactionId) {
      return json({ error: 'missing_purchase_fields' }, 400);
    }

    const internalProductId = normalizeProductId(body.productId);
    if (!internalProductId) {
      return json({ error: 'unsupported_product' }, 400);
    }

    const supabase = getAdminClient();
    const token = getBearerToken(request);
    if (!token) return json({ error: 'missing_auth' }, 401);

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'invalid_auth' }, 401);

    await ensureMembership(supabase, body.accountId, userData.user.id);
    const verification = await verifyApplePurchase(
      body.productId,
      internalProductId,
      body.transactionId,
      body.signedTransactionInfo ?? body.purchaseToken,
    );
    const result = await processVerifiedPurchase(supabase, {
      accountId: body.accountId,
      internalProductId,
      storeProductId: body.productId,
    }, verification);

    return json({
      ok: true,
      alreadyProcessed: result.alreadyProcessed,
      internalProductId,
      productId: body.productId,
      usage: result.usage,
    });
  } catch (error) {
    console.error('verify-apple-purchase failed', error);
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
