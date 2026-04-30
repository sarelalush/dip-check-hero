import type { StripResults } from "./analyzeStripImage";
import type { DosageRecommendation } from "./calculateDosage";

export type PoolType = "chlorine" | "salt";

export interface Pool {
  id: string;
  name: string;
  type: PoolType;
  volumeLiters: number;
  createdAt: number;
  lastTestAt?: number;
}

export interface TestRecord {
  id: string;
  poolId: string;
  date: number;
  results: StripResults;
  recommendations: DosageRecommendation[];
  imageDataUrl?: string;
}

const POOLS_KEY = "poolcheck.pools";
const TESTS_KEY = "poolcheck.tests";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}
function write<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export const poolStorage = {
  list: (): Pool[] => read<Pool>(POOLS_KEY).sort((a, b) => b.createdAt - a.createdAt),
  get: (id: string): Pool | undefined => read<Pool>(POOLS_KEY).find((p) => p.id === id),
  save: (pool: Pool) => {
    const all = read<Pool>(POOLS_KEY);
    const idx = all.findIndex((p) => p.id === pool.id);
    if (idx >= 0) all[idx] = pool;
    else all.push(pool);
    write(POOLS_KEY, all);
  },
  remove: (id: string) => {
    write(POOLS_KEY, read<Pool>(POOLS_KEY).filter((p) => p.id !== id));
    write(TESTS_KEY, read<TestRecord>(TESTS_KEY).filter((t) => t.poolId !== id));
  },
};

export const testStorage = {
  listByPool: (poolId: string): TestRecord[] =>
    read<TestRecord>(TESTS_KEY).filter((t) => t.poolId === poolId).sort((a, b) => b.date - a.date),
  save: (test: TestRecord) => {
    const all = read<TestRecord>(TESTS_KEY);
    all.push(test);
    write(TESTS_KEY, all);
    const pool = poolStorage.get(test.poolId);
    if (pool) {
      pool.lastTestAt = test.date;
      poolStorage.save(pool);
    }
  },
};

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
