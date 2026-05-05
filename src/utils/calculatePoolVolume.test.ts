import { describe, it, expect } from "vitest";
import { calculatePoolVolume } from "./calculatePoolVolume";

describe("calculatePoolVolume", () => {
  it("computes rectangle volume in liters", () => {
    expect(calculatePoolVolume({ shape: "rectangle", length: 8, width: 4, depth: 1.5 })).toBe(48000);
  });

  it("computes round volume in liters", () => {
    const v = calculatePoolVolume({ shape: "round", diameter: 4, depth: 1.2 });
    // π * 2^2 * 1.2 * 1000 ≈ 15080
    expect(v).toBeGreaterThan(15000);
    expect(v).toBeLessThan(15200);
  });

  it("computes oval volume in liters with 0.785 factor", () => {
    expect(calculatePoolVolume({ shape: "oval", length: 6, width: 3, depth: 1.5 })).toBe(21195);
  });

  it("returns an integer", () => {
    const v = calculatePoolVolume({ shape: "rectangle", length: 5.3, width: 2.7, depth: 1.4 });
    expect(Number.isInteger(v)).toBe(true);
  });
});
