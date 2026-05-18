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
  it("recommends chlorine when free chlorine is low and pH/TA ok", () => {
    const recs = calculateDosage(
      makeResults({
        freeChlorine: { labelHe: "כלור חופשי", value: 0.5, unit: "ppm", status: "low" },
      }),
      chlorinePool,
    );
    const fc = recs.find((r) => r.paramKey === "freeChlorine");
    expect(fc?.status).toBe("low");
    // 1.5 ppm × 50 m³ / 100 = 0.75 L = 750 ml
    expect(fc?.product?.amount).toBe(750);
  });

  it("does not surface chlorine action when pH is out of range", () => {
    const recs = calculateDosage(
      makeResults({
        ph: { labelHe: "pH", value: 8.2, unit: "", status: "high" },
        freeChlorine: { labelHe: "כלור חופשי", value: 0.5, unit: "ppm", status: "low" },
      }),
      chlorinePool,
    );
    // Only alkalinity (ok) + pH (active) should appear; chlorine deferred.
    expect(recs.find((r) => r.paramKey === "freeChlorine")).toBeUndefined();
    expect(recs.find((r) => r.paramKey === "ph")?.product?.key).toBe("acidHCl");
  });

  it("does not surface pH action when alkalinity is out of range", () => {
    const recs = calculateDosage(
      makeResults({
        alkalinity: { labelHe: "אלקליניות", value: 60, unit: "ppm", status: "low" },
        ph: { labelHe: "pH", value: 8.2, unit: "", status: "high" },
        freeChlorine: { labelHe: "כלור חופשי", value: 0.5, unit: "ppm", status: "low" },
      }),
      chlorinePool,
    );
    expect(recs.find((r) => r.paramKey === "alkalinity")?.status).toBe("low");
    expect(recs.find((r) => r.paramKey === "ph")).toBeUndefined();
    expect(recs.find((r) => r.paramKey === "freeChlorine")).toBeUndefined();
  });

  it("switches to pH (aeration) when alkalinity is high but pH is already low", () => {
    const recs = calculateDosage(
      makeResults({
        alkalinity: { labelHe: "אלקליניות", value: 180, unit: "ppm", status: "high" },
        ph: { labelHe: "pH", value: 7.0, unit: "", status: "low" },
      }),
      chlorinePool,
    );
    const ph = recs.find((r) => r.paramKey === "ph");
    expect(ph).toBeDefined();
    expect(ph?.product).toBeUndefined();
    expect(ph?.actionHe).toMatch(/אוורור|סחרור|מפלים/);
    // No acid recommendation should appear.
    expect(recs.find((r) => r.product?.key === "acidHCl")).toBeUndefined();
  });


  it("waits instead of dosing when free chlorine is only slightly high", () => {
    const recs = calculateDosage(
      makeResults({
        freeChlorine: { labelHe: "כלור חופשי", value: 4, unit: "ppm", status: "high" },
      }),
      chlorinePool,
    );
    const fc = recs.find((r) => r.paramKey === "freeChlorine");
    expect(fc?.status).toBe("high");
    expect(fc?.product).toBeUndefined();
    expect(fc?.actionHe).toMatch(/המתין/);
  });

  it("recommends acid when pH is high and TA ok", () => {
    const recs = calculateDosage(
      makeResults({ ph: { labelHe: "pH", value: 7.8, unit: "", status: "high" } }),
      chlorinePool,
    );
    const ph = recs.find((r) => r.paramKey === "ph");
    expect(ph?.product?.key).toBe("acidHCl");
    expect(ph?.product?.amount).toBeGreaterThan(0);
  });

  it("recommends pH plus when pH is low and TA ok", () => {
    const recs = calculateDosage(
      makeResults({ ph: { labelHe: "pH", value: 7.0, unit: "", status: "low" } }),
      chlorinePool,
    );
    const ph = recs.find((r) => r.paramKey === "ph");
    expect(ph?.product?.key).toBe("phPlus");
  });

  it("aerates instead of acid when pH is low but alkalinity is high", () => {
    const recs = calculateDosage(
      makeResults({
        alkalinity: { labelHe: "אלקליניות", value: 180, unit: "ppm", status: "high" },
        ph: { labelHe: "pH", value: 7.0, unit: "", status: "low" },
      }),
      chlorinePool,
    );
    const ph = recs.find((r) => r.paramKey === "ph");
    expect(ph?.product).toBeUndefined();
    expect(ph?.actionHe).toMatch(/אוורור|סחרור|מפלים/);
  });

  it("recommends sodium bicarbonate when alkalinity is low", () => {
    const recs = calculateDosage(
      makeResults({
        alkalinity: { labelHe: "אלקליניות", value: 60, unit: "ppm", status: "low" },
      }),
      chlorinePool,
    );
    const a = recs.find((r) => r.paramKey === "alkalinity");
    expect(a?.status).toBe("low");
    // (100-60) × 50 / 670 ≈ 2.98 kg → grams ≈ 3000
    expect(a?.product?.amount).toBeGreaterThan(2500);
    expect(a?.product?.amount).toBeLessThan(3500);
  });

  it("emits only alkalinity when all three are off (one-at-a-time)", () => {
    const recs = calculateDosage(
      makeResults({
        alkalinity: { labelHe: "אלקליניות", value: 60, unit: "ppm", status: "low" },
        ph: { labelHe: "pH", value: 7.0, unit: "", status: "low" },
        freeChlorine: { labelHe: "כלור חופשי", value: 0.5, unit: "ppm", status: "low" },
      }),
      chlorinePool,
    );
    expect(recs.map((r) => r.paramKey)).toEqual(["alkalinity"]);
    expect(recs[0].product?.labelHe).toMatch(/Alkalinity Increaser|סודה לשתייה/);
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
