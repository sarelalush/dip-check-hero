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
  syncing: boolean;
  syncError?: string;
  addPool: (pool: NewPoolInput) => Pool;
  updatePool: (poolId: string, updates: UpdatePoolInput) => Pool | undefined;
  deletePool: (poolId: string) => void;
  getPool: (poolId: string) => Pool | undefined;
}

const PoolsContext = createContext<PoolsContextValue | null>(null);
const POOLS_STORAGE_KEY = '@aquasense/pools';

export function PoolsProvider({ children }: { children: ReactNode }) {
  const { accountId, user, loading: authLoading } = useAuth();
  const [pools, setPools] = useState<Pool[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | undefined>();

  useEffect(() => {
    let isMounted = true;

    async function restorePools() {
      try {
        const storedPools = await AsyncStorage.getItem(POOLS_STORAGE_KEY);
        if (!isMounted) return;
        if (storedPools) {
          const parsedPools = JSON.parse(storedPools) as Pool[];
          if (Array.isArray(parsedPools)) {
            setPools(dedupePools(parsedPools.map((pool) => normalizePool(pool))));
          }
        }
      } catch (error) {
        console.warn('Failed to restore pools from storage', error);
      } finally {
        if (isMounted) {
          setHydrated(true);
        }
      }
    }

    restorePools();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    async function persistPools() {
      try {
        await AsyncStorage.setItem(POOLS_STORAGE_KEY, JSON.stringify(dedupePools(pools)));
      } catch (error) {
        console.warn('Failed to persist pools to storage', error);
      }
    }

    persistPools();
  }, [hydrated, pools]);

  useEffect(() => {
    if (!hydrated || authLoading || !user || !accountId) return;

    let isMounted = true;
    const currentUser = user;
    const currentAccountId = accountId;

    async function syncAuthenticatedPools() {
      setSyncing(true);
      setSyncError(undefined);

      try {
        const result = await syncPoolsWithCloud(pools, currentUser, currentAccountId);
        if (!isMounted) return;
        setPools(dedupePools(result.pools));
      } catch (error) {
        if (!isMounted) return;
        console.warn('Failed to sync pools with cloud', error);
        setSyncError('סנכרון הבריכות לענן נכשל. הנתונים המקומיים נשמרו.');
      } finally {
        if (isMounted) {
          setSyncing(false);
        }
      }
    }

    syncAuthenticatedPools();

    return () => {
      isMounted = false;
    };
  }, [accountId, authLoading, hydrated, user?.id]);

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
      pools,
      hydrated,
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
    [accountId, hydrated, pools, syncError, syncing, user],
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
