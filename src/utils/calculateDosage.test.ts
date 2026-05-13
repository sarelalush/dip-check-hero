import { describe, it, expect } from "vitest";
import { calculateDosage } from "./calculateDosage";
import type { Pool } from "./storage";
import type { StripResults } from "./analyzeStripImage";

const chlorinePool: Pool = {
  id: "p1",
  name: "Test",
  type: "chlorine",
  volumeLiters: 50000,
  createdAt: 0,
};

const saltPool: Pool = { ...chlorinePool, id: "p2", type: "salt" };

function makeResults(overrides: Partial<StripResults> = {}): StripResults {
  return {
    brandId: "aquachek-yellow-4",
    readings: {},
    source: "ai",
    confidence: 0.9,
    freeChlorine: { labelHe: "כלור חופשי", value: 2, unit: "ppm", status: "ok" },
    ph: { labelHe: "pH", value: 7.4, unit: "", status: "ok" },
    alkalinity: { labelHe: "אלקליניות", value: 100, unit: "ppm", status: "ok" },
    ...overrides,
  };
}

describe("calculateDosage", () => {
  it("recommends chlorine when free chlorine is low", () => {
    const recs = calculateDosage(
      makeResults({
        freeChlorine: { labelHe: "כלור חופשי", value: 0.5, unit: "ppm", status: "low" },
      }),
      chlorinePool,
    );
    const fc = recs.find((r) => r.paramKey === "freeChlorine");
    expect(fc?.status).toBe("low");
    expect(fc?.product?.key).toBe("chlorineLiquid10");
    // diff=1.5 ppm * 100 ml/ppm/10kL * 5 (50,000L) = 750 ml
    expect(fc?.product?.amount).toBe(750);
  });

  it("warns when free chlorine is high without dosing product", () => {
    const recs = calculateDosage(
      makeResults({
        freeChlorine: { labelHe: "כלור חופשי", value: 5, unit: "ppm", status: "high" },
      }),
      chlorinePool,
    );
    const fc = recs.find((r) => r.paramKey === "freeChlorine");
    expect(fc?.status).toBe("high");
    expect(fc?.product).toBeUndefined();
  });

  it("recommends pH minus when pH is high", () => {
    const recs = calculateDosage(
      makeResults({ ph: { labelHe: "pH", value: 7.8, unit: "", status: "high" } }),
      chlorinePool,
    );
    const ph = recs.find((r) => r.paramKey === "ph");
    expect(ph?.product?.key).toBe("acidHCl");
    expect(ph?.product?.amount).toBeGreaterThan(0);
  });

  it("recommends pH plus when pH is low", () => {
    const recs = calculateDosage(
      makeResults({ ph: { labelHe: "pH", value: 7.0, unit: "", status: "low" } }),
      chlorinePool,
    );
    const ph = recs.find((r) => r.paramKey === "ph");
    expect(ph?.product?.key).toBe("phPlus");
  });

  it("returns 'ok' actions when all readings are in range", () => {
    const recs = calculateDosage(makeResults(), chlorinePool);
    expect(recs.every((r) => r.status === "ok")).toBe(true);
    expect(recs.every((r) => !r.product)).toBe(true);
  });

  it("ignores salt for chlorine pools", () => {
    const recs = calculateDosage(
      makeResults({ salt: { labelHe: "מלח", value: 1000, unit: "ppm", status: "low" } }),
      chlorinePool,
    );
    expect(recs.find((r) => r.paramKey === "salt")).toBeUndefined();
  });

  it("recommends salt for saltwater pools when low", () => {
    const recs = calculateDosage(
      makeResults({ salt: { labelHe: "מלח", value: 2000, unit: "ppm", status: "low" } }),
      saltPool,
    );
    const s = recs.find((r) => r.paramKey === "salt");
    expect(s?.product?.key).toBe("poolSalt");
    expect(s?.product?.amount).toBeGreaterThan(0);
  });
});
