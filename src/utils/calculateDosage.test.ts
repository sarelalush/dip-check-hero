import { describe, it, expect } from "vitest";
import { calculateDosage } from "./calculateDosage";
import type { Pool } from "./storage";
import type { StripResults } from "./analyzeStripImage";

const chlorinePool: Pool = {
  id: "p1", name: "Test", type: "chlorine", volumeLiters: 50000, createdAt: 0,
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
  it("includes all readings as cards", () => {
    const recs = calculateDosage(makeResults(), chlorinePool);
    expect(recs.map((r) => r.paramKey).sort()).toEqual(
      ["alkalinity", "freeChlorine", "ph"].sort(),
    );
  });

  it("marks at most one card active", () => {
    const recs = calculateDosage(
      makeResults({
        alkalinity: { labelHe: "אלקליניות", value: 60, unit: "ppm", status: "low" },
        ph: { labelHe: "pH", value: 7.0, unit: "", status: "low" },
        freeChlorine: { labelHe: "כלור חופשי", value: 0.5, unit: "ppm", status: "low" },
      }),
      chlorinePool,
    );
    const active = recs.filter((r) => r.active);
    expect(active.length).toBe(1);
  });

  it("alkalinity gets the active flag when it's the only primary issue", () => {
    const recs = calculateDosage(
      makeResults({
        alkalinity: { labelHe: "אלקליניות", value: 60, unit: "ppm", status: "low" },
        freeChlorine: { labelHe: "כלור חופשי", value: 0.5, unit: "ppm", status: "low" },
      }),
      chlorinePool,
    );
    expect(recs.find((r) => r.active)?.paramKey).toBe("alkalinity");
  });


  it("pH <7.2 jumps ahead of alkalinity", () => {
    const recs = calculateDosage(
      makeResults({
        alkalinity: { labelHe: "אלקליניות", value: 60, unit: "ppm", status: "low" },
        ph: { labelHe: "pH", value: 7.1, unit: "", status: "low" },
      }),
      chlorinePool,
    );
    expect(recs.find((r) => r.active)?.paramKey).toBe("ph");
  });

  it("pH >8.0 jumps ahead of alkalinity", () => {
    const recs = calculateDosage(
      makeResults({
        alkalinity: { labelHe: "אלקליניות", value: 60, unit: "ppm", status: "low" },
        ph: { labelHe: "pH", value: 8.3, unit: "", status: "high" },
      }),
      chlorinePool,
    );
    const active = recs.find((r) => r.active);
    expect(active?.paramKey).toBe("ph");
    expect(active?.product?.key).toBe("acidHCl");
  });

  it("pH unsafe + alkalinity high → aerate (no acid)", () => {
    const recs = calculateDosage(
      makeResults({
        alkalinity: { labelHe: "אלקליניות", value: 180, unit: "ppm", status: "high" },
        ph: { labelHe: "pH", value: 7.0, unit: "", status: "low" },
      }),
      chlorinePool,
    );
    const active = recs.find((r) => r.active);
    expect(active?.paramKey).toBe("ph");
    expect(active?.product).toBeUndefined();
    expect(active?.actionHe).toMatch(/אוורור|סחרור/);
  });

  it("chlorine becomes active only when alkalinity and pH are ok", () => {
    const recs = calculateDosage(
      makeResults({
        freeChlorine: { labelHe: "כלור חופשי", value: 0.5, unit: "ppm", status: "low" },
      }),
      chlorinePool,
    );
    const active = recs.find((r) => r.active);
    expect(active?.paramKey).toBe("freeChlorine");
    expect(active?.product?.amount).toBe(750); // 1.5×50/100 = 0.75L
  });

  it("no card is active when everything is in range", () => {
    const recs = calculateDosage(makeResults(), chlorinePool);
    expect(recs.every((r) => !r.active)).toBe(true);
    expect(recs.every((r) => r.status === "ok")).toBe(true);
  });

  it("salt is excluded for chlorine pools", () => {
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
    expect(s?.active).toBe(true);
    expect(s?.product?.key).toBe("poolSalt");
  });
});
