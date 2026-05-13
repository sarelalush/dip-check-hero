import { describe, it, expect, beforeAll } from "vitest";
import { installCanvasMock, makeStripFixture } from "./__fixtures__/canvasMock";

beforeAll(() => {
  installCanvasMock();
});

import { analyzeStripPixels } from "./colorUtils";

const TOL = 0.5;

// Reference colors come from the OFFICIAL AquaChek Pro 5-in-1 chart.
describe("analyzeStripPixels — synthetic AquaChek fixtures", () => {
  it("reads exact reference colors (TC=3, TB=5, FC=4, pH=7.2, Alk=120)", async () => {
    const url = makeStripFixture({
      id: "exact-mid",
      tc: [184, 216, 140],   // combined TC=3 / TB=5 (yellow-green)
      fc: [200, 140, 195],   // FC=4 (purple — the critical fix!)
      ph: [225, 80, 50],     // pH=7.2 (red-orange)
      alk: [72, 111, 54],    // Alk=120 (dark green)
    });
    const r = await analyzeStripPixels(url);
    expect(r.totalChlorine!).toBeCloseTo(3, 1);
    expect(r.bromine!).toBeCloseTo(5, 1);
    expect(r.freeChlorine!).toBeCloseTo(4, 1);
    expect(r.ph!).toBeCloseTo(7.2, 1);
    expect(Math.abs(r.alkalinity! - 120)).toBeLessThanOrEqual(20);
    expect(r.confidence).toBeGreaterThan(0.85);
  });

  it("reads low end (TC=0, FC=0, pH=6.2, Alk=0)", async () => {
    const url = makeStripFixture({
      id: "low",
      tc: [254, 254, 168],
      br: [254, 254, 168],
      fc: [254, 254, 204],
      ph: [242, 200, 90],
      alk: [227, 192, 64],
    });
    const r = await analyzeStripPixels(url);
    expect(r.totalChlorine!).toBeLessThanOrEqual(0.5);
    expect(r.freeChlorine!).toBeLessThanOrEqual(0.5);
    expect(Math.abs(r.ph! - 6.2)).toBeLessThanOrEqual(TOL);
    expect(r.alkalinity!).toBeLessThanOrEqual(20);
  });

  it("reads high end (TC=10, FC=10, pH=8.4, Alk=240)", async () => {
    const url = makeStripFixture({
      id: "high",
      tc: [55, 140, 80],
      fc: [130, 55, 160],   // dark purple — high FC
      ph: [195, 110, 170],
      alk: [37, 87, 98],
    });
    const r = await analyzeStripPixels(url);
    expect(r.totalChlorine!).toBeGreaterThanOrEqual(8);
    expect(r.freeChlorine!).toBeGreaterThanOrEqual(8);
    expect(Math.abs(r.ph! - 8.4)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(r.alkalinity! - 240)).toBeLessThanOrEqual(25);
  });

  it("FC purple gradient is distinguished from pH pink gradient", async () => {
    const purple = makeStripFixture({
      id: "fc-purple",
      fc: [200, 140, 195],   // FC=4 purple
      ph: [235, 150, 150],   // pH=7.2 salmon-pink
      alk: [72, 111, 54],
    });
    const r = await analyzeStripPixels(purple);
    expect(r.freeChlorine!).toBeGreaterThan(2);
    expect(r.ph!).toBeGreaterThan(6.8);
    expect(r.ph!).toBeLessThan(7.6);
  });

  it("flags low confidence on a clearly off-chart color", async () => {
    const url = makeStripFixture({
      id: "off",
      fc: [0, 255, 0],
      ph: [0, 0, 255],
      alk: [255, 0, 255],
    });
    const r = await analyzeStripPixels(url);
    expect(r.confidence).toBeLessThan(0.5);
  });
});
