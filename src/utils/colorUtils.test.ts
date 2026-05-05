import { describe, it, expect, beforeAll } from "vitest";
import { installCanvasMock, makeStripFixture } from "./__fixtures__/canvasMock";

beforeAll(() => {
  installCanvasMock();
});

// Import AFTER mocks are wired so the module sees patched globals if needed.
import { analyzeStripPixels } from "./colorUtils";

const TOL = 0.5; // ±0.5 on continuous params; alkalinity uses ±20 (50-step refs)

describe("analyzeStripPixels — synthetic fixtures", () => {
  it("reads exact reference colors (FC=3, pH=7.6, Alk=120)", async () => {
    const url = makeStripFixture({
      id: "exact-mid",
      fc: [255, 180, 100], // ref FC=3
      ph: [210, 80, 100], // ref pH=7.6
      alk: [80, 140, 130], // ref Alk=120
    });
    const r = await analyzeStripPixels(url);
    expect(r.freeChlorine).toBeCloseTo(3, 1);
    expect(r.ph).toBeCloseTo(7.6, 1);
    expect(Math.abs(r.alkalinity - 120)).toBeLessThanOrEqual(20);
    expect(r.confidence).toBeGreaterThan(0.9);
  });

  it("reads low end (FC=0, pH=6.2, Alk=0)", async () => {
    const url = makeStripFixture({
      id: "low",
      fc: [255, 255, 230],
      ph: [240, 200, 100],
      alk: [240, 230, 100],
    });
    const r = await analyzeStripPixels(url);
    expect(Math.abs(r.freeChlorine - 0)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(r.ph - 6.2)).toBeLessThanOrEqual(TOL);
    expect(r.alkalinity).toBeLessThanOrEqual(20);
  });

  it("reads high end (FC=10, pH=8.4, Alk=240)", async () => {
    const url = makeStripFixture({
      id: "high",
      fc: [200, 80, 50],
      ph: [150, 40, 100],
      alk: [30, 80, 120],
    });
    const r = await analyzeStripPixels(url);
    expect(Math.abs(r.freeChlorine - 10)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(r.ph - 8.4)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(r.alkalinity - 240)).toBeLessThanOrEqual(20);
  });

  it("interpolates between reference levels (mix of FC=1 and FC=3)", async () => {
    // Average of ref(1)=[255,220,140] and ref(3)=[255,180,100] → [255,200,120]
    const url = makeStripFixture({
      id: "interp",
      fc: [255, 200, 120],
      ph: [210, 80, 100],
      alk: [80, 140, 130],
    });
    const r = await analyzeStripPixels(url);
    expect(r.freeChlorine).toBeGreaterThan(1);
    expect(r.freeChlorine).toBeLessThan(3);
  });

  it("flags low confidence on a clearly off-chart color", async () => {
    const url = makeStripFixture({
      id: "off",
      fc: [0, 255, 0], // pure green — not on chlorine chart
      ph: [0, 0, 255],
      alk: [255, 0, 255],
    });
    const r = await analyzeStripPixels(url);
    expect(r.confidence).toBeLessThan(0.5);
  });
});
