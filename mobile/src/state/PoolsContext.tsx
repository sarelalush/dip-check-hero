import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  calculateRectangularVolumeLiters,
  type NewPoolInput,
  normalizePool,
  type Pool,
  type PoolShape,
  type PoolType,
  type UpdatePoolInput,
} from '../domain/pool';

interface PoolsContextValue {
  pools: Pool[];
  addPool: (pool: NewPoolInput) => Pool;
  updatePool: (poolId: string, updates: UpdatePoolInput) => Pool | undefined;
  deletePool: (poolId: string) => void;
  getPool: (poolId: string) => Pool | undefined;
}

const PoolsContext = createContext<PoolsContextValue | null>(null);
const POOLS_STORAGE_KEY = '@aquasense/pools';

export function PoolsProvider({ children }: { children: ReactNode }) {
  const [pools, setPools] = useState<Pool[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function restorePools() {
      try {
        const storedPools = await AsyncStorage.getItem(POOLS_STORAGE_KEY);
        if (!isMounted) return;
        if (storedPools) {
          const parsedPools = JSON.parse(storedPools) as Pool[];
          if (Array.isArray(parsedPools)) {
            setPools(parsedPools.map((pool) => normalizePool(pool)));
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
        await AsyncStorage.setItem(POOLS_STORAGE_KEY, JSON.stringify(pools));
      } catch (error) {
        console.warn('Failed to persist pools to storage', error);
      }
    }

    persistPools();
  }, [hydrated, pools]);

  const value = useMemo<PoolsContextValue>(
    () => ({
      pools,
      addPool(input) {
        const now = Date.now();
        const pool = normalizePool({
          ...input,
          id: `pool-${now}`,
          createdAt: input.createdAt ?? now,
          updatedAt: now,
        });
        setPools((current) => [pool, ...current]);
        return pool;
      },
      updatePool(poolId, updates) {
        let updatedPool: Pool | undefined;
        setPools((current) =>
          current.map((pool) => {
            if (pool.id !== poolId) return pool;
            updatedPool = normalizePool({ ...pool, ...updates, id: pool.id, createdAt: pool.createdAt, updatedAt: Date.now() });
            return updatedPool;
          }),
        );
        return updatedPool;
      },
      deletePool(poolId) {
        setPools((current) => current.filter((pool) => pool.id !== poolId));
      },
      getPool(poolId) {
        return pools.find((pool) => pool.id === poolId);
      },
    }),
    [pools],
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
