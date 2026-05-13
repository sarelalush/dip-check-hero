// Stress test: generate many synthetic AquaChek Pro 5-in-1 strip fixtures
// (4 physical pads each) with noise, lighting drift, and off-center positions.
import { describe, it, expect, beforeAll } from "vitest";
import { PNG } from "pngjs";
import { installCanvasMock, registerPng } from "./__fixtures__/canvasMock";

beforeAll(() => {
  installCanvasMock();
});

import { analyzeStripPixels } from "./colorUtils";

// Mirror the OFFICIAL AquaChek Pro REFS so we can author "ground truth" strips.
const TC_TB = [
  { value: 0, rgb: [254, 254, 168] },
  { value: 0.5, rgb: [242, 254, 170] },
  { value: 1, rgb: [231, 245, 160] },
  { value: 3, rgb: [184, 216, 140] },
  { value: 5, rgb: [100, 180, 105] },
  { value: 10, rgb: [55, 140, 80] },
] as const;

const REFS = {
  totalChlorine: TC_TB,
  bromine: TC_TB,
  freeChlorine: [
    { value: 0, rgb: [254, 254, 204] },
    { value: 0.5, rgb: [247, 235, 228] },
    { value: 1, rgb: [235, 215, 225] },
    { value: 2, rgb: [220, 180, 210] },
    { value: 4, rgb: [200, 140, 195] },
    { value: 6, rgb: [175, 110, 190] },
    { value: 10, rgb: [130, 55, 160] },
  ],
  ph: [
    { value: 6.2, rgb: [242, 175, 60] },
    { value: 6.8, rgb: [234, 106, 45] },
    { value: 7.2, rgb: [225, 80, 50] },
    { value: 7.8, rgb: [210, 55, 45] },
    { value: 8.4, rgb: [180, 45, 45] },
  ],
  alkalinity: [
    { value: 0, rgb: [227, 192, 64] },
    { value: 40, rgb: [164, 169, 51] },
    { value: 80, rgb: [137, 159, 58] },
    { value: 120, rgb: [72, 111, 54] },
    { value: 180, rgb: [35, 82, 46] },
    { value: 240, rgb: [37, 87, 98] },
  ],
} as const;

type RGB = [number, number, number];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpRgb(a: readonly number[], b: readonly number[], t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function colorForValue(refs: readonly { value: number; rgb: readonly number[] }[], v: number): RGB {
  if (v <= refs[0].value) return refs[0].rgb as unknown as RGB;
  if (v >= refs[refs.length - 1].value) return refs[refs.length - 1].rgb as unknown as RGB;
  for (let i = 0; i < refs.length - 1; i++) {
    const a = refs[i], b = refs[i + 1];
    if (v >= a.value && v <= b.value)
      return lerpRgb(a.rgb, b.rgb, (v - a.value) / (b.value - a.value));
  }
  return refs[refs.length - 1].rgb as unknown as RGB;
}

interface StressOpts {
  id: string;
  fc: number; ph: number; alk: number;
  tc?: number; br?: number;
  noise?: number;
  cast?: RGB;
  shiftX?: number;
  width?: number;
  height?: number;
}

function buildStrip(o: StressOpts): string {
  const width = o.width ?? 80;
  const height = o.height ?? 400;
  const png = new PNG({ width, height });
  const cast = o.cast ?? [1, 1, 1];
  const noise = o.noise ?? 0;

  const padTrue: RGB[] = [
    colorForValue(REFS.totalChlorine, o.tc ?? o.fc),
    colorForValue(REFS.freeChlorine, o.fc),
    colorForValue(REFS.ph, o.ph),
    colorForValue(REFS.alkalinity, o.alk),
  ];

  const top = height * 0.2;
  const padH = (height * 0.6) / 4;
  const stripCx = width / 2 + (o.shiftX ?? 0);
  const stripHalfW = width * 0.35;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = 230, g = 230, b = 230;
      const inStrip = Math.abs(x - stripCx) < stripHalfW;
      const padIdx = Math.floor((y - top) / padH);
      if (inStrip && padIdx >= 0 && padIdx < 4) {
        const c = padTrue[padIdx];
        r = c[0]; g = c[1]; b = c[2];
      }
      if (noise > 0) {
        r += (Math.random() - 0.5) * 2 * noise;
        g += (Math.random() - 0.5) * 2 * noise;
        b += (Math.random() - 0.5) * 2 * noise;
      }
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

let seed = 1;
Math.random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

describe("analyzeStripPixels — stress: many synthetic AquaChek Pro strips", () => {
  const fcVals = [0, 1, 3, 5, 10];
  const phVals = [6.2, 6.8, 7.2, 7.8, 8.4];
  const alkVals = [0, 40, 80, 120, 180, 240];

  it("handles many clean strip combinations within tolerance", async () => {
    const cases: StressOpts[] = [];
    let n = 0;
    for (const fc of fcVals)
      for (const ph of phVals)
        for (const alk of alkVals) {
          if (n++ % 3 !== 0) continue;
          cases.push({ id: `clean-${fc}-${ph}-${alk}`, fc, ph, alk });
        }
    let fcErr = 0, phErr = 0, alkErr = 0;
    for (const c of cases) {
      const r = await analyzeStripPixels(buildStrip(c));
      fcErr += Math.abs(r.freeChlorine! - c.fc);
      phErr += Math.abs(r.ph! - c.ph);
      alkErr += Math.abs(r.alkalinity! - c.alk);
    }
    const N = cases.length;
    console.log(`Clean — N=${N} meanErr fc=${(fcErr / N).toFixed(2)} ph=${(phErr / N).toFixed(2)} alk=${(alkErr / N).toFixed(1)}`);
    expect(fcErr / N).toBeLessThan(1.2);
    expect(phErr / N).toBeLessThan(0.6);
    expect(alkErr / N).toBeLessThan(40);
  });

  it("survives moderate sensor noise (±15)", async () => {
    const cases = [
      { fc: 1, ph: 7.2, alk: 80 },
      { fc: 3, ph: 7.2, alk: 120 },
      { fc: 5, ph: 7.8, alk: 180 },
    ];
    let fcErr = 0, phErr = 0, alkErr = 0;
    for (const c of cases) {
      const r = await analyzeStripPixels(buildStrip({ id: `noise-${c.fc}`, ...c, noise: 15 }));
      fcErr += Math.abs(r.freeChlorine! - c.fc);
      phErr += Math.abs(r.ph! - c.ph);
      alkErr += Math.abs(r.alkalinity! - c.alk);
    }
    expect(fcErr / 3).toBeLessThan(1.5);
    expect(phErr / 3).toBeLessThan(0.7);
    expect(alkErr / 3).toBeLessThan(50);
  });

  it("handles slight horizontal off-center strip", async () => {
    const c = { fc: 3, ph: 7.2, alk: 120 };
    const r = await analyzeStripPixels(buildStrip({ id: "shift", ...c, shiftX: 8 }));
    expect(Math.abs(r.freeChlorine! - c.fc)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(r.ph! - c.ph)).toBeLessThanOrEqual(0.7);
  });

  it("flags low confidence on multiple off-chart strips", async () => {
    const offColors: RGB[][] = [
      [[0, 0, 0], [255, 255, 255], [128, 0, 128]],
      [[0, 255, 255], [255, 0, 255], [255, 255, 0]],
    ];
    for (let i = 0; i < offColors.length; i++) {
      const png = new PNG({ width: 60, height: 400 });
      for (let y = 0; y < 400; y++) for (let x = 0; x < 60; x++) {
        const idx = (y * 60 + x) * 4;
        png.data[idx] = 230; png.data[idx + 1] = 230; png.data[idx + 2] = 230; png.data[idx + 3] = 255;
      }
      const top = 80, padH = 60;
      // Pad order: combined TC+TB, FC, pH, ALK
      const pads = [offColors[i][0], offColors[i][0], offColors[i][1], offColors[i][2]];
      for (let p = 0; p < 4; p++) {
        for (let y = top + p * padH; y < top + (p + 1) * padH; y++)
          for (let x = 0; x < 60; x++) {
            const idx = (y * 60 + x) * 4;
            png.data[idx] = pads[p][0]; png.data[idx + 1] = pads[p][1]; png.data[idx + 2] = pads[p][2]; png.data[idx + 3] = 255;
          }
      }
      const url = `mock://off-${i}.png`;
      registerPng(url, png);
      const r = await analyzeStripPixels(url);
      expect(r.confidence).toBeLessThan(0.6);
    }
  });
});
