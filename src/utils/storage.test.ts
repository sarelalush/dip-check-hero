import { describe, it, expect, beforeEach } from "vitest";
import { poolStorage, testStorage, newId, type Pool, type TestRecord } from "./storage";

function makePool(overrides: Partial<Pool> = {}): Pool {
  return {
    id: newId(),
    name: "Pool",
    type: "chlorine",
    volumeLiters: 30000,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("newId returns unique strings", () => {
    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(5);
  });

  it("saves and lists pools (newest first)", () => {
    const p1 = makePool({ name: "A", createdAt: 100 });
    const p2 = makePool({ name: "B", createdAt: 200 });
    poolStorage.save(p1);
    poolStorage.save(p2);
    const list = poolStorage.list();
    expect(list.map((p) => p.name)).toEqual(["B", "A"]);
  });

  it("updates an existing pool by id", () => {
    const p = makePool({ name: "Old" });
    poolStorage.save(p);
    poolStorage.save({ ...p, name: "New" });
    expect(poolStorage.get(p.id)?.name).toBe("New");
    expect(poolStorage.list().length).toBe(1);
  });

  it("removes pool and its tests", () => {
    const p = makePool();
    poolStorage.save(p);
    const test: TestRecord = {
      id: newId(),
      poolId: p.id,
      date: Date.now(),
      results: { brandId: "x", readings: {}, source: "ai", confidence: 1 },
      recommendations: [],
    };
    testStorage.save(test);
    expect(testStorage.listByPool(p.id).length).toBe(1);
    poolStorage.remove(p.id);
    expect(poolStorage.get(p.id)).toBeUndefined();
    expect(testStorage.listByPool(p.id).length).toBe(0);
  });

  it("updates pool.lastTestAt when saving a test", () => {
    const p = makePool();
    poolStorage.save(p);
    const date = Date.now() + 1000;
    testStorage.save({
      id: newId(),
      poolId: p.id,
      date,
      results: { brandId: "x", readings: {}, source: "ai", confidence: 1 },
      recommendations: [],
    });
    expect(poolStorage.get(p.id)?.lastTestAt).toBe(date);
  });
});
