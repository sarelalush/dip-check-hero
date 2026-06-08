import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

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

export function PoolsProvider({ children }: { children: ReactNode }) {
  const [pools, setPools] = useState<Pool[]>([]);

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
