// Mobile pool cloud parity source:
// src/lib/cloudSync.ts, src/utils/storage.ts, src/integrations/supabase/types.ts.
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../integrations/supabase/client';
import type { Database, Json } from '../integrations/supabase/types';
import { dedupePools, normalizePool, type Pool } from '../domain/pool';
import { getSignedPoolImageUrl, isLocalPoolImageCandidate, removePoolImage, uploadPoolImage } from './poolImageStorage';

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

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? {})) as Json;
}

function readObject(value: Json | null | undefined): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

export function getPoolCloudId(pool: Pool) {
  if (pool.cloudId) return pool.cloudId;
  if (isUuid(pool.id)) return pool.id;
  return newUuid();
}

export function mapCloudPoolToLocal(row: PoolRow): Pool {
  const createdAt = toMillis(row.created_at) ?? Date.now();
  const updatedAt = toMillis(row.updated_at) ?? createdAt;
  const dimensions = readObject(row.dimensions);
  const treatment = readObject(dimensions.treatment as Json);
  const shape = row.shape === 'round' || row.shape === 'oval' || row.shape === 'rectangle' ? row.shape : readString(dimensions.shape);
  const sanitizerType = row.sanitizer_type === 'salt' ? 'salt' : 'chlorine';

  return normalizePool({
    id: row.id,
    cloudId: row.id,
    name: row.name,
    imagePath: row.image_path ?? undefined,
    imageUrl: row.image_url ?? undefined,
    type: sanitizerType,
    sanitizerType,
    volumeLiters: Number(row.volume_liters ?? 0),
    volumeEntryMethod: readString(dimensions.volumeEntryMethod) === 'dimensions' ? 'dimensions' : 'manual',
    volumeUnit: readString(dimensions.volumeUnit) === 'cubic' ? 'cubic' : 'liters',
    shape: shape === 'round' || shape === 'oval' || shape === 'rectangle' ? shape : 'rectangle',
    lengthMeters: readNumber(dimensions.lengthMeters),
    widthMeters: readNumber(dimensions.widthMeters),
    diameterMeters: readNumber(dimensions.diameterMeters),
    averageDepthMeters: readNumber(dimensions.averageDepthMeters),
    stripBrandId: readString(dimensions.stripBrandId),
    notes: row.notes ?? undefined,
    createdAt,
    updatedAt,
    lastTestAt: readNumber(dimensions.lastTestAt),
    tabletsActive: readBoolean(treatment.tabletsActive) ?? false,
    tabletsCount: readNumber(treatment.tabletsCount) ?? 1,
    tabletWeightGrams: readNumber(treatment.tabletWeightGrams) ?? 200,
    pumpHoursPerDay: readNumber(treatment.pumpHoursPerDay) ?? 8,
    retestHours: readNumber(treatment.retestHours) ?? 6,
  });
}

async function mapCloudPoolToLocalWithSignedImage(row: PoolRow): Promise<Pool> {
  const pool = mapCloudPoolToLocal(row);
  if (!pool.imagePath || pool.imageUrl) return pool;
  return normalizePool({
    ...pool,
    imageUrl: await getSignedPoolImageUrl(pool.imagePath),
  });
}

export function mapLocalPoolToCloud(pool: Pool, userId: string, accountId: string): PoolUpsert {
  const cloudId = getPoolCloudId(pool);
  const now = new Date(pool.updatedAt ?? Date.now()).toISOString();

  return {
    id: cloudId,
    account_id: accountId,
    owner_user_id: userId,
    name: pool.name,
    image_path: pool.imagePath ?? null,
    image_url: pool.imagePath ? null : (pool.imageUrl ?? null),
    pool_type: pool.type,
    sanitizer_type: pool.sanitizerType ?? pool.type,
    volume_liters: pool.volumeLiters,
    shape: pool.shape ?? null,
    dimensions: toJson({
      shape: pool.shape,
      lengthMeters: pool.lengthMeters,
      widthMeters: pool.widthMeters,
      diameterMeters: pool.diameterMeters,
      averageDepthMeters: pool.averageDepthMeters,
      volumeEntryMethod: pool.volumeEntryMethod,
      volumeUnit: pool.volumeUnit,
      stripBrandId: pool.stripBrandId,
      lastTestAt: pool.lastTestAt,
      treatment: {
        tabletsActive: pool.tabletsActive ?? false,
        tabletsCount: pool.tabletsCount ?? 1,
        tabletWeightGrams: pool.tabletWeightGrams ?? 200,
        pumpHoursPerDay: pool.pumpHoursPerDay ?? 8,
        retestHours: pool.retestHours ?? 6,
      },
    }),
    notes: pool.notes ?? null,
    is_archived: false,
    created_at: new Date(pool.createdAt).toISOString(),
    updated_at: now,
  };
}

export async function fetchCloudPools(accountId: string): Promise<Pool[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getSupabaseClient()
    .from('pools')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return Promise.all((data ?? []).map(mapCloudPoolToLocalWithSignedImage));
}

export async function upsertPoolToCloud(pool: Pool, userId: string, accountId: string): Promise<Pool> {
  const cloudId = getPoolCloudId(pool);
  let localPool = normalizePool({ ...pool, cloudId, updatedAt: pool.updatedAt ?? Date.now() });

  if (!isSupabaseConfigured) return localPool;

  if (localPool.imageUri && !localPool.imagePath && !localPool.imageUrl && isLocalPoolImageCandidate(localPool.imageUri)) {
    try {
      const uploadedImage = await uploadPoolImage({
        accountId,
        imageUri: localPool.imageUri,
        poolId: cloudId,
        userId,
      });

      localPool = normalizePool({
        ...localPool,
        imagePath: uploadedImage?.path,
        imageUrl: uploadedImage?.signedUrl,
        imageUploadError: undefined,
      });
    } catch (error) {
      console.warn('Failed to upload pool cover image', error);
      localPool = normalizePool({
        ...localPool,
        imageUploadError: 'העלאת תמונת הבריכה לענן נכשלה. התמונה נשמרה מקומית.',
      });
    }
  }

  const { error } = await getSupabaseClient()
    .from('pools')
    .upsert(mapLocalPoolToCloud(localPool, userId, accountId));

  if (error) throw error;
  return localPool;
}

export async function deletePoolFromCloud(pool: Pool, _userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const cloudId = pool.cloudId ?? (isUuid(pool.id) ? pool.id : undefined);
  if (!cloudId) return;

  const { error } = await getSupabaseClient().from('pools').update({ is_archived: true }).eq('id', cloudId);
  if (error) throw error;
  await removePoolImage(pool.imagePath);
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
export async function syncPoolsWithCloud(localPools: Pool[], user: User, accountId: string): Promise<PoolSyncResult> {
  if (!isSupabaseConfigured) {
    return { pools: localPools.map((pool) => normalizePool(pool)), pushedCount: 0, pulledCount: 0 };
  }

  const remotePools = await fetchCloudPools(accountId);
  const remoteByCloudId = new Map(remotePools.map((pool) => [pool.cloudId ?? pool.id, pool]));
  const merged: Pool[] = [];
  let pushedCount = 0;
  let pulledCount = 0;

  for (const localPool of localPools.map((pool) => normalizePool(pool))) {
    const cloudId = poolSyncKey(localPool);
    const remotePool = cloudId ? remoteByCloudId.get(cloudId) : undefined;

    if (!remotePool) {
      const pushed = await upsertPoolToCloud(localPool, user.id, accountId);
      pushedCount += 1;
      merged.push(pushed);
      if (pushed.cloudId) remoteByCloudId.delete(pushed.cloudId);
      continue;
    }

    remoteByCloudId.delete(remotePool.cloudId ?? remotePool.id);

    const localUpdatedAt = localPool.updatedAt ?? localPool.createdAt;
    const remoteUpdatedAt = remotePool.updatedAt ?? remotePool.createdAt;

    if (localUpdatedAt >= remoteUpdatedAt) {
      const pushed = await upsertPoolToCloud({ ...localPool, cloudId: remotePool.cloudId ?? remotePool.id }, user.id, accountId);
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

  const pools = dedupePools(Array.from(unique.values())).sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
  return { pools, pushedCount, pulledCount };
}
