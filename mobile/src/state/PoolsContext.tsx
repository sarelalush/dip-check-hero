import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type PoolShape = 'rectangle';

export interface Pool {
  id: string;
  name: string;
  shape: PoolShape;
  lengthMeters: number;
  widthMeters: number;
  averageDepthMeters: number;
  volumeLiters: number;
  notes?: string;
  createdAt: number;
}

export interface NewPoolInput {
  name: string;
  shape: PoolShape;
  lengthMeters: number;
  widthMeters: number;
  averageDepthMeters: number;
  volumeLiters: number;
  notes?: string;
}

interface PoolsContextValue {
  pools: Pool[];
  addPool: (pool: NewPoolInput) => Pool;
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
            setPools(parsedPools);
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
        const pool: Pool = {
          ...input,
          id: `pool-${Date.now()}`,
          createdAt: Date.now(),
        };
        setPools((current) => [pool, ...current]);
        return pool;
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

export function calculateRectangularVolumeLiters(
  lengthMeters: number,
  widthMeters: number,
  averageDepthMeters: number,
) {
  return Math.round(lengthMeters * widthMeters * averageDepthMeters * 1000);
}
