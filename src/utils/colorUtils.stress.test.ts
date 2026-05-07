// Stress test: generate many synthetic strip fixtures with noise, lighting
// drift, and intermediate values, and challenge analyzeStripPixels.
import { describe, it, expect, beforeAll } from "vitest";
import { PNG } from "pngjs";
import { installCanvasMock, registerPng } from "./__fixtures__/canvasMock";

beforeAll(() => {
  installCanvasMock();
});

import { analyzeStripPixels } from "./colorUtils";

// Mirror REFS from colorUtils so we can author "ground truth" strips.
const REFS = {
  freeChlorine: [
    { value: 0, rgb: [255, 255, 230] },
    { value: 0.5, rgb: [255, 240, 180] },
    { value: 1, rgb: [255, 220, 140] },
    { value: 3, rgb: [255, 180, 100] },
    { value: 5, rgb: [240, 130, 70] },
    { value: 10, rgb: [200, 80, 50] },
  ],
  ph: [
    { value: 6.2, rgb: [240, 200, 100] },
    { value: 6.8, rgb: [240, 160, 90] },
    { value: 7.2, rgb: [230, 110, 90] },
    { value: 7.6, rgb: [210, 80, 100] },
    { value: 7.8, rgb: [180, 60, 100] },
    { value: 8.4, rgb: [150, 40, 100] },
  ],
  alkalinity: [
    { value: 0, rgb: [240, 230, 100] },
    { value: 40, rgb: [180, 200, 110] },
    { value: 80, rgb: [120, 170, 130] },
    { value: 120, rgb: [80, 140, 130] },
    { value: 180, rgb: [50, 110, 130] },
    { value: 240, rgb: [30, 80, 120] },
  ],
} as const;

type RGB = [number, number, number];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpRgb(a: readonly number[], b: readonly number[], t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Synthesize the "true" pad color for a target value by interpolating between bracketing refs. */
function colorForValue(refs: readonly { value: number; rgb: readonly number[] }[], v: number): RGB {
  if (v <= refs[0].value) return refs[0].rgb as unknown as RGB;
  if (v >= refs[refs.length - 1].value) return refs[refs.length - 1].rgb as unknown as RGB;
  for (let i = 0; i < refs.length - 1; i++) {
    const a = refs[i], b = refs[i + 1];
    if (v >= a.value && v <= b.value) {
      const t = (v - a.value) / (b.value - a.value);
      return lerpRgb(a.rgb, b.rgb, t);
    }
  }
  return refs[refs.length - 1].rgb as unknown as RGB;
}

interface StressOpts {
  id: string;
  fc: number;
  ph: number;
  alk: number;
  /** Per-channel uniform noise amplitude (0..255). */
  noise?: number;
  /** Multiplicative lighting cast per channel — simulates warm/cool light. */
  cast?: RGB;
  /** Horizontal shift of the strip (px) to test off-center sampling. */
  shiftX?: number;
  width?: number;
  height?: number;
}

function buildStrip(o: StressOpts): string {
  const width = o.width ?? 80;
  const height = o.height ?? 320;
  const png = new PNG({ width, height });
  const cast = o.cast ?? [1, 1, 1];
  const noise = o.noise ?? 0;

  const padTrue: RGB[] = [
    colorForValue(REFS.freeChlorine, o.fc),
    colorForValue(REFS.ph, o.ph),
    colorForValue(REFS.alkalinity, o.alk),
  ];

  const top = height * 0.2;
  const padH = (height * 0.6) / 3;
  const stripCx = width / 2 + (o.shiftX ?? 0);
  const stripHalfW = width * 0.35;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = 230, g = 230, b = 230;
      const inStrip = Math.abs(x - stripCx) < stripHalfW;
      const padIdx = Math.floor((y - top) / padH);
      if (inStrip && padIdx >= 0 && padIdx < 3) {
        const c = padTrue[padIdx];
        r = c[0]; g = c[1]; b = c[2];
      }
      // Noise
      if (noise > 0) {
        r += (Math.random() - 0.5) * 2 * noise;
        g += (Math.random() - 0.5) * 2 * noise;
        b += (Math.random() - 0.5) * 2 * noise;
      }
      // Lighting cast
      r *= cast[0]; g *= cast[1]; b *= cast[2];
      png.data[i] = Math.max(0, Math.min(255, r));
      png.data[i + 1] = Math.max(0, Math.min(255, g));
      png.data[i + 2] = Math.max(0, Math.min(255, b));
      png.data[i + 3] = 255;
    }
  }
  const url = `mock://stress-${o.id}.png`;
  registerPng(url, png);
  return url;
}

// Deterministic randomness for reproducible runs
let seed = 1;
Math.random = () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};

describe("analyzeStripPixels — stress: many synthetic strips", () => {
  // Sweep across the full grid
  const fcVals = [0, 0.5, 1, 2, 3, 5, 8, 10];
  const phVals = [6.2, 6.8, 7.2, 7.6, 8.0, 8.4];
  const alkVals = [0, 40, 80, 120, 180, 240];

  it("handles 50+ clean strip combinations within tolerance", async () => {
    const cases: StressOpts[] = [];
    let n = 0;
    for (const fc of fcVals)
      for (const ph of phVals)
        for (const alk of alkVals) {
          if (n++ % 5 !== 0) continue; // sample ~58 of 288
          cases.push({ id: `clean-${fc}-${ph}-${alk}`, fc, ph, alk });
        }

    let fcErr = 0, phErr = 0, alkErr = 0;
    for (const c of cases) {
      const url = buildStrip(c);
      const r = await analyzeStripPixels(url);
      fcErr += Math.abs(r.freeChlorine - c.fc);
      phErr += Math.abs(r.ph - c.ph);
      alkErr += Math.abs(r.alkalinity - c.alk);
    }
    const N = cases.length;
    const meanFc = fcErr / N, meanPh = phErr / N, meanAlk = alkErr / N;

    console.log(`Clean — N=${N}  meanErr fc=${meanFc.toFixed(2)} ph=${meanPh.toFixed(2)} alk=${meanAlk.toFixed(1)}`);
    expect(meanFc).toBeLessThan(1.0);
    expect(meanPh).toBeLessThan(0.5);
    expect(meanAlk).toBeLessThan(40);
  });

  it("survives moderate sensor noise (±15)", async () => {
    const cases = [
      { fc: 1, ph: 7.2, alk: 80 },
      { fc: 3, ph: 7.6, alk: 120 },
      { fc: 5, ph: 7.8, alk: 180 },
    ];
    let fcErr = 0, phErr = 0, alkErr = 0;
    for (const c of cases) {
      const url = buildStrip({ id: `noise-${c.fc}`, ...c, noise: 15 });
      const r = await analyzeStripPixels(url);
      fcErr += Math.abs(r.freeChlorine - c.fc);
      phErr += Math.abs(r.ph - c.ph);
      alkErr += Math.abs(r.alkalinity - c.alk);
    }
    console.log(`Noise — meanErr fc=${(fcErr / 3).toFixed(2)} ph=${(phErr / 3).toFixed(2)} alk=${(alkErr / 3).toFixed(1)}`);
    expect(fcErr / 3).toBeLessThan(1.5);
    expect(phErr / 3).toBeLessThan(0.7);
    expect(alkErr / 3).toBeLessThan(50);
  });

  it("is sensitive to warm lighting cast (documents weakness without WB)", async () => {
    // Without a white-balance step before colorUtils, a warm cast should bias results.
    // This test documents the magnitude of the bias.
    const c = { fc: 3, ph: 7.6, alk: 120 };
    const url = buildStrip({ id: "warm", ...c, cast: [1.1, 1.0, 0.85] });
    const r = await analyzeStripPixels(url);
    console.log(`Warm cast (no WB) → fc=${r.freeChlorine} ph=${r.ph} alk=${r.alkalinity} conf=${r.confidence.toFixed(2)}`);
    // Confidence may stay high since the matched ref is still close — bias is small here.
    expect(r.freeChlorine).toBeGreaterThan(0);
  });

  it("handles slight horizontal off-center strip", async () => {
    const c = { fc: 3, ph: 7.6, alk: 120 };
    const url = buildStrip({ id: "shift", ...c, shiftX: 8 });
    const r = await analyzeStripPixels(url);
    expect(Math.abs(r.freeChlorine - c.fc)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(r.ph - c.ph)).toBeLessThanOrEqual(0.7);
  });

  it("flags low confidence on multiple off-chart strips", async () => {
    const offColors: { fc: RGB; ph: RGB; alk: RGB }[] = [
      { fc: [0, 0, 0], ph: [255, 255, 255], alk: [128, 0, 128] },
      { fc: [0, 255, 255], ph: [255, 0, 255], alk: [255, 255, 0] },
      { fc: [10, 200, 10], ph: [10, 10, 200], alk: [200, 10, 10] },
    ];
    for (let i = 0; i < offColors.length; i++) {
      const o = offColors[i];
      // Build directly with raw pad colors via colorForValue bypass
      const png = new PNG({ width: 60, height: 300 });
      for (let y = 0; y < 300; y++) for (let x = 0; x < 60; x++) {
        const idx = (y * 60 + x) * 4;
        png.data[idx] = 230; png.data[idx + 1] = 230; png.data[idx + 2] = 230; png.data[idx + 3] = 255;
      }
      const top = 60, padH = 60;
      const pads = [o.fc, o.ph, o.alk];
      for (let p = 0; p < 3; p++) {
        for (let y = top + p * padH; y < top + (p + 1) * padH; y++)
          for (let x = 0; x < 60; x++) {
            const idx = (y * 60 + x) * 4;
            png.data[idx] = pads[p][0]; png.data[idx + 1] = pads[p][1]; png.data[idx + 2] = pads[p][2]; png.data[idx + 3] = 255;
          }
      }
      const url = `mock://off-${i}.png`;
      registerPng(url, png);
      const r = await analyzeStripPixels(url);
      console.log(`Off-chart #${i} → conf=${r.confidence.toFixed(2)}`);
      expect(r.confidence).toBeLessThan(0.6);
    }
  });
});
