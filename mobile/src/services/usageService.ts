import { getSupabaseClient, isSupabaseConfigured } from '../integrations/supabase/client';

export const BASE_PLAN = {
  activePoolLimit: 1,
  includedScans: 200,
  name: 'AquaSense Basic',
  priceIls: 30,
};

export const PLAN_ADDONS = {
  extraPool: {
    name: 'בריכה נוספת',
    priceIls: 10,
    quantity: 1,
  },
  extraScans: {
    name: 'עוד 200 סריקות',
    priceIls: 20,
    quantity: 200,
  },
};

const PLAN_ADDONS_ENABLED = true;

export interface PlanUsageInfo {
  activePoolLimit: number;
  activePoolsUsed: number;
  includedPools: number;
  includedScans: number;
  planName: string;
  scansLimit: number;
  scansUsed: number;
  status?: string;
}

export function getFallbackPlanUsage(activePoolsUsed = 0): PlanUsageInfo {
  return {
    activePoolLimit: BASE_PLAN.activePoolLimit,
    activePoolsUsed,
    includedPools: BASE_PLAN.activePoolLimit,
    includedScans: BASE_PLAN.includedScans,
    planName: BASE_PLAN.name,
    scansLimit: BASE_PLAN.includedScans,
    scansUsed: 0,
  };
}

export async function canCreatePool(accountId?: string, localActivePools = 0) {
  if (!PLAN_ADDONS_ENABLED && localActivePools >= BASE_PLAN.activePoolLimit) {
    return false;
  }

  if (!isSupabaseConfigured || !accountId) return true;

  try {
    const { data, error } = await getSupabaseClient().rpc('can_create_pool', { p_account_id: accountId });
    if (error) throw error;
    return data !== false;
  } catch (error) {
    console.warn('Failed to check pool quota, allowing local fallback', error);
    return true;
  }
}

export async function canCreateScan(accountId?: string) {
  if (!isSupabaseConfigured || !accountId) return true;

  try {
    const { data, error } = await getSupabaseClient().rpc('can_create_scan', { p_account_id: accountId });
    if (error) throw error;
    return data !== false;
  } catch (error) {
    console.warn('Failed to check scan quota, allowing local fallback', error);
    return true;
  }
}

async function fetchPlanName(planId?: string | null) {
  if (!planId) return BASE_PLAN.name;

  const { data, error } = await getSupabaseClient()
    .from('plans')
    .select('name')
    .eq('id', planId)
    .maybeSingle();

  if (error) throw error;
  return data?.name ?? BASE_PLAN.name;
}

export async function fetchPlanUsage(accountId?: string, localActivePools = 0): Promise<PlanUsageInfo> {
  if (!isSupabaseConfigured || !accountId) {
    return getFallbackPlanUsage(localActivePools);
  }

  try {
    const [entitlementsResponse, usageResponse, subscriptionResponse] = await Promise.all([
      getSupabaseClient().rpc('get_current_account_entitlements', { p_account_id: accountId }),
      getSupabaseClient()
        .from('usage_periods')
        .select('*')
        .eq('account_id', accountId)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle(),
      getSupabaseClient()
        .from('subscriptions')
        .select('plan_id,status')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (entitlementsResponse.error) throw entitlementsResponse.error;
    if (usageResponse.error) throw usageResponse.error;
    if (subscriptionResponse.error) throw subscriptionResponse.error;

    const entitlements = entitlementsResponse.data;
    const usage = usageResponse.data;
    const subscription = subscriptionResponse.data;
    const planName = await fetchPlanName(subscription?.plan_id);
    const activePoolLimit = PLAN_ADDONS_ENABLED
      ? entitlements?.total_pool_limit ?? usage?.pools_limit ?? BASE_PLAN.activePoolLimit
      : entitlements?.included_pools ?? BASE_PLAN.activePoolLimit;
    const scansLimit = PLAN_ADDONS_ENABLED
      ? entitlements?.total_scan_limit ?? usage?.scans_limit ?? BASE_PLAN.includedScans
      : entitlements?.included_scans ?? BASE_PLAN.includedScans;

    return {
      activePoolLimit,
      activePoolsUsed: localActivePools,
      includedPools: entitlements?.included_pools ?? BASE_PLAN.activePoolLimit,
      includedScans: entitlements?.included_scans ?? BASE_PLAN.includedScans,
      planName,
      scansLimit,
      scansUsed: usage?.scans_used ?? 0,
      status: subscription?.status ?? undefined,
    };
  } catch (error) {
    console.warn('Failed to fetch plan usage, using safe fallback', error);
    return getFallbackPlanUsage(localActivePools);
  }
}
