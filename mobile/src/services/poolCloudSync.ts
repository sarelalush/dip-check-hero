// Mobile pool cloud parity source:
// src/lib/cloudSync.ts, src/utils/storage.ts, src/integrations/supabase/types.ts.
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../integrations/supabase/client';
import type { Database } from '../integrations/supabase/types';
import { normalizePool, type Pool } from '../domain/pool';

type PoolRow = Database['public']['Tables']['pools']['Row'];
type PoolUpsert = Database['public']['Tables']['pools']['Insert'];

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(id);
}

function newUuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function toMillis(value?: string | null) {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
}

export function getPoolCloudId(pool: Pool) {
  if (pool.cloudId) return pool.cloudId;
  if (isUuid(pool.id)) return pool.id;
  return newUuid();
}

export function mapCloudPoolToLocal(row: PoolRow): Pool {
  const createdAt = toMillis(row.created_at) ?? Date.now();
  const updatedAt = toMillis(row.updated_at) ?? createdAt;

  return normalizePool({
    id: row.id,
    cloudId: row.id,
    name: row.name,
    type: row.type === 'salt' ? 'salt' : 'chlorine',
    sanitizerType: row.type === 'salt' ? 'salt' : 'chlorine',
    volumeLiters: row.volume_liters,
    volumeEntryMethod: 'manual',
    volumeUnit: 'liters',
    stripBrandId: row.strip_brand_id ?? undefined,
    createdAt,
    updatedAt,
    lastTestAt: toMillis(row.last_test_at),
    tabletsActive: row.tablets_active ?? false,
    tabletsCount: row.tablets_count ?? 1,
    tabletWeightGrams: row.tablet_weight_g ?? 200,
    pumpHoursPerDay: Number(row.pump_hours_per_day ?? 8),
    retestHours: Number(row.retest_hours ?? 6),
  });
}

export function mapLocalPoolToCloud(pool: Pool, userId: string): PoolUpsert {
  const cloudId = getPoolCloudId(pool);
  const now = new Date(pool.updatedAt ?? Date.now()).toISOString();

  return {
    id: cloudId,
    user_id: userId,
    name: pool.name,
    type: pool.type,
    volume_liters: pool.volumeLiters,
    strip_brand_id: pool.stripBrandId ?? null,
    last_test_at: pool.lastTestAt ? new Date(pool.lastTestAt).toISOString() : null,
    tablets_active: pool.tabletsActive ?? false,
    tablets_count: pool.tabletsCount ?? 1,
    tablet_weight_g: pool.tabletWeightGrams ?? 200,
    pump_hours_per_day: pool.pumpHoursPerDay ?? 8,
    retest_hours: pool.retestHours ?? 6,
    created_at: new Date(pool.createdAt).toISOString(),
    updated_at: now,
  };
}

export async function fetchCloudPools(userId: string): Promise<Pool[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getSupabaseClient()
    .from('pools')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapCloudPoolToLocal);
}

export async function upsertPoolToCloud(pool: Pool, userId: string): Promise<Pool> {
  const cloudId = getPoolCloudId(pool);
  const localPool = normalizePool({ ...pool, cloudId, updatedAt: pool.updatedAt ?? Date.now() });

  if (!isSupabaseConfigured) return localPool;

  const { error } = await getSupabaseClient()
    .from('pools')
    .upsert(mapLocalPoolToCloud(localPool, userId));

  if (error) throw error;
  return localPool;
}

export async function deletePoolFromCloud(pool: Pool, _userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const cloudId = pool.cloudId ?? (isUuid(pool.id) ? pool.id : undefined);
  if (!cloudId) return;

  const { error } = await getSupabaseClient().from('pools').delete().eq('id', cloudId);
  if (error) throw error;
}

function poolSyncKey(pool: Pool) {
  return pool.cloudId ?? (isUuid(pool.id) ? pool.id : undefined);
}

export interface PoolSyncResult {
  pools: Pool[];
  pushedCount: number;
  pulledCount: number;
}

// Simple conflict strategy for the first cloud-sync slice:
// keep local pools visible from AsyncStorage, fetch cloud pools after auth, and
// prefer the record with the newest updatedAt/updated_at. Local-only fields
// such as dimensions and notes stay in the AsyncStorage cache until matching
// columns exist in Supabase.
export async function syncPoolsWithCloud(localPools: Pool[], user: User): Promise<PoolSyncResult> {
  if (!isSupabaseConfigured) {
    return { pools: localPools.map((pool) => normalizePool(pool)), pushedCount: 0, pulledCount: 0 };
  }

  const remotePools = await fetchCloudPools(user.id);
  const remoteByCloudId = new Map(remotePools.map((pool) => [pool.cloudId ?? pool.id, pool]));
  const merged: Pool[] = [];
  let pushedCount = 0;
  let pulledCount = 0;

  for (const localPool of localPools.map((pool) => normalizePool(pool))) {
    const cloudId = poolSyncKey(localPool);
    const remotePool = cloudId ? remoteByCloudId.get(cloudId) : undefined;

    if (!remotePool) {
      const pushed = await upsertPoolToCloud(localPool, user.id);
      pushedCount += 1;
      merged.push(pushed);
      if (pushed.cloudId) remoteByCloudId.delete(pushed.cloudId);
      continue;
    }

    remoteByCloudId.delete(remotePool.cloudId ?? remotePool.id);

    const localUpdatedAt = localPool.updatedAt ?? localPool.createdAt;
    const remoteUpdatedAt = remotePool.updatedAt ?? remotePool.createdAt;

    if (localUpdatedAt >= remoteUpdatedAt) {
      const pushed = await upsertPoolToCloud({ ...localPool, cloudId: remotePool.cloudId ?? remotePool.id }, user.id);
      pushedCount += 1;
      merged.push(pushed);
    } else {
      pulledCount += 1;
      merged.push(
        normalizePool({
          ...localPool,
          ...remotePool,
          id: localPool.id,
          cloudId: remotePool.cloudId ?? remotePool.id,
        }),
      );
    }
  }

  for (const remotePool of remoteByCloudId.values()) {
    pulledCount += 1;
    merged.push(remotePool);
  }

  const unique = new Map<string, Pool>();
  for (const pool of merged) {
    const key = pool.cloudId ?? pool.id;
    unique.set(key, normalizePool(pool));
  }

  const pools = Array.from(unique.values()).sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
  return { pools, pushedCount, pulledCount };
}
