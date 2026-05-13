import { describe, it, expect } from "vitest";
import { STRIP_BRANDS, DEFAULT_BRAND_ID, getBrand, PARAM_LABEL_HE } from "./stripBrands";

describe("stripBrands registry", () => {
  it("exposes 6 brands including AquaChek Pro demo default", () => {
    expect(STRIP_BRANDS.length).toBe(6);
    expect(DEFAULT_BRAND_ID).toBe("aquachek-pro-5in1");
    expect(STRIP_BRANDS[0].id).toBe("aquachek-pro-5in1");
    expect(STRIP_BRANDS[0].parameters).toEqual([
      "totalChlorine",
      "bromine",
      "freeChlorine",
      "ph",
      "alkalinity",
    ]);
  });

  it("each brand has unique id and at least one parameter", () => {
    const ids = new Set<string>();
    for (const b of STRIP_BRANDS) {
      expect(b.id).toBeTruthy();
      expect(ids.has(b.id)).toBe(false);
      ids.add(b.id);
      expect(b.parameters.length).toBeGreaterThan(0);
      for (const p of b.parameters) {
        expect(PARAM_LABEL_HE[p]).toBeDefined();
      }
    }
  });

  it("getBrand falls back to default for unknown id", () => {
    expect(getBrand("nonexistent").id).toBe(STRIP_BRANDS[0].id);
    expect(getBrand(undefined).id).toBe(STRIP_BRANDS[0].id);
  });

  it("getBrand returns matching brand by id", () => {
    expect(getBrand(DEFAULT_BRAND_ID).id).toBe(DEFAULT_BRAND_ID);
    expect(getBrand("hth-6-way").nameHe).toContain("HTH");
  });
});
