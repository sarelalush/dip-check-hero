import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  calculateRectangularVolumeLiters,
  dedupePools,
  getPoolFingerprint,
  type NewPoolInput,
  normalizePool,
  type Pool,
  type PoolShape,
  type PoolType,
  type UpdatePoolInput,
} from '../domain/pool';
import { useAuth } from './AuthContext';
import { deletePoolFromCloud, syncPoolsWithCloud, upsertPoolToCloud } from '../services/poolCloudSync';

interface PoolsContextValue {
  pools: Pool[];
  hydrated: boolean;
  initialSyncComplete: boolean;
  syncing: boolean;
  syncError?: string;
  addPool: (pool: NewPoolInput) => Pool;
  updatePool: (poolId: string, updates: UpdatePoolInput) => Pool | undefined;
  deletePool: (poolId: string) => void;
  getPool: (poolId: string) => Pool | undefined;
}

const PoolsContext = createContext<PoolsContextValue | null>(null);
const POOLS_STORAGE_KEY = '@aquasense/pools';
const POOLS_CACHE_READY_KEY = '@aquasense/pools-cache-ready';

function getPoolsStorageKey(ownerKey: string) {
  return `${POOLS_STORAGE_KEY}:${ownerKey}`;
}

function getPoolsCacheReadyKey(ownerKey: string) {
  return `${POOLS_CACHE_READY_KEY}:${ownerKey}`;
}

export function PoolsProvider({ children }: { children: ReactNode }) {
  const { accountId, user, loading: authLoading } = useAuth();
  const [pools, setPools] = useState<Pool[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [hydratedOwnerKey, setHydratedOwnerKey] = useState<string | undefined>();
  const [initialSyncComplete, setInitialSyncComplete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | undefined>();
  const ownerKey = authLoading ? undefined : user && accountId ? `${user.id}:${accountId}` : 'anonymous';
  const isReadyForOwner = Boolean(ownerKey && hydratedOwnerKey === ownerKey && hydrated);

  useEffect(() => {
    if (!ownerKey) {
      setPools([]);
      setHydrated(false);
      setHydratedOwnerKey(undefined);
      setInitialSyncComplete(false);
      setSyncing(false);
      setSyncError(undefined);
      return undefined;
    }

    let isMounted = true;
    const storageKey = getPoolsStorageKey(ownerKey);
    const cacheReadyKey = getPoolsCacheReadyKey(ownerKey);

    async function restorePools() {
      setPools([]);
      setHydrated(false);
      setHydratedOwnerKey(undefined);
      setInitialSyncComplete(false);
      setSyncError(undefined);

      try {
        const [storedPools, cacheReady] = await Promise.all([
          AsyncStorage.getItem(storageKey),
          AsyncStorage.getItem(cacheReadyKey),
        ]);
        if (!isMounted) return;
        let hasUsableCache = cacheReady === 'true';

        if (storedPools) {
          const parsedPools = JSON.parse(storedPools) as Pool[];
          if (Array.isArray(parsedPools)) {
            const restoredPools = dedupePools(parsedPools.map((pool) => normalizePool(pool)));
            setPools(restoredPools);
            hasUsableCache = hasUsableCache || restoredPools.length > 0;
          }
        }

        if (hasUsableCache) {
          setInitialSyncComplete(true);
        }
      } catch (error) {
        console.warn('Failed to restore pools from storage', error);
      } finally {
        if (isMounted) {
          setHydratedOwnerKey(ownerKey);
          setHydrated(true);
          setInitialSyncComplete((current) => current || ownerKey === 'anonymous');
        }
      }
    }

    restorePools();

    return () => {
      isMounted = false;
    };
  }, [ownerKey]);

  useEffect(() => {
    if (!hydrated || !hydratedOwnerKey) return;
    const storageKey = getPoolsStorageKey(hydratedOwnerKey);

    async function persistPools() {
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(dedupePools(pools)));
      } catch (error) {
        console.warn('Failed to persist pools to storage', error);
      }
    }

    persistPools();
  }, [hydrated, hydratedOwnerKey, pools]);

  useEffect(() => {
    if (!hydrated || !ownerKey || hydratedOwnerKey !== ownerKey || authLoading || !user || !accountId) return;

    let isMounted = true;
    const currentUser = user;
    const currentAccountId = accountId;
    const cacheReadyKey = getPoolsCacheReadyKey(ownerKey);

    async function syncAuthenticatedPools() {
      setSyncing(true);
      setSyncError(undefined);

      try {
        const result = await syncPoolsWithCloud(pools, currentUser, currentAccountId);
        if (!isMounted) return;
        setPools(dedupePools(result.pools));
        await AsyncStorage.setItem(cacheReadyKey, 'true');
      } catch (error) {
        if (!isMounted) return;
        console.warn('Failed to sync pools with cloud', error);
        setSyncError('סנכרון הבריכות לענן נכשל. הנתונים המקומיים נשמרו.');
      } finally {
        if (isMounted) {
          setSyncing(false);
          setInitialSyncComplete(true);
        }
      }
    }

    syncAuthenticatedPools();

    return () => {
      isMounted = false;
    };
  }, [accountId, authLoading, hydrated, hydratedOwnerKey, ownerKey, user?.id]);

  async function syncPoolToCloud(pool: Pool) {
    if (!user || !accountId) return;

    try {
      const syncedPool = await upsertPoolToCloud(pool, user.id, accountId);
      setPools((current) =>
        dedupePools(current.map((item) =>
          item.id === pool.id || item.cloudId === syncedPool.cloudId
            ? normalizePool({ ...item, ...syncedPool, id: item.id })
            : item,
        )),
      );
      setSyncError(undefined);
    } catch (error) {
      console.warn('Failed to sync pool with cloud', error);
      setSyncError('שמירת הבריכה לענן נכשלה. היא נשמרה מקומית.');
    }
  }

  const value = useMemo<PoolsContextValue>(
    () => ({
      pools: isReadyForOwner ? pools : [],
      hydrated: isReadyForOwner,
      initialSyncComplete: isReadyForOwner && initialSyncComplete,
      syncing,
      syncError,
      addPool(input) {
        const now = Date.now();
        const pool = normalizePool({
          ...input,
          id: `pool-${now}`,
          createdAt: input.createdAt ?? now,
          updatedAt: now,
        });
        const duplicatePool = pools.find((item) => getPoolFingerprint(item) === getPoolFingerprint(pool));
        if (duplicatePool) return duplicatePool;
        setPools((current) => dedupePools([pool, ...current]));
        syncPoolToCloud(pool);
        return pool;
      },
      updatePool(poolId, updates) {
        let updatedPool: Pool | undefined;
        setPools((current) =>
          dedupePools(current.map((pool) => {
            if (pool.id !== poolId && pool.cloudId !== poolId) return pool;
            updatedPool = normalizePool({ ...pool, ...updates, id: pool.id, createdAt: pool.createdAt, updatedAt: Date.now() });
            return updatedPool;
          })),
        );
        if (updatedPool) {
          syncPoolToCloud(updatedPool);
        }
        return updatedPool;
      },
      deletePool(poolId) {
        const poolToDelete = pools.find((pool) => pool.id === poolId || pool.cloudId === poolId);
        setPools((current) => current.filter((pool) => pool.id !== poolId && pool.cloudId !== poolId));
        if (poolToDelete && user) {
          deletePoolFromCloud(poolToDelete, user.id).catch((error) => {
            console.warn('Failed to delete pool from cloud', error);
            setSyncError('מחיקת הבריכה מהענן נכשלה. היא נמחקה מקומית.');
          });
        }
      },
      getPool(poolId) {
        return pools.find((pool) => pool.id === poolId || pool.cloudId === poolId);
      },
    }),
    [accountId, hydrated, initialSyncComplete, isReadyForOwner, pools, syncError, syncing, user],
  );

  return <PoolsContext.Provider value={value}>{children}</PoolsContext.Provider>;
}

export function usePools() {
  const context = useContext(PoolsContext);
  if (!context) {
    throw new Error('usePools must be used inside PoolsProvider');
  }
  return context;
}

export { calculateRectangularVolumeLiters };
export type { NewPoolInput, Pool, PoolShape, PoolType, UpdatePoolInput };
