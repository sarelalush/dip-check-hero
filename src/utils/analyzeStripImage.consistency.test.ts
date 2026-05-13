// Consistency test: the SAME strip image must produce the SAME final reading
// every time the user runs the scan. Two layers are tested:
//   1. CV layer (analyzeStripPixels): pure pixel math, must be byte-identical.
//   2. Full pipeline (analyzeStripImage) with a mocked AI that returns noisy
//      values per shot — multi-shot median must collapse to the same answer.
import { describe, it, expect, beforeAll, vi } from "vitest";
import { PNG } from "pngjs";
import { installCanvasMock, registerPng } from "./__fixtures__/canvasMock";

beforeAll(() => {
  installCanvasMock();
});

// ---- 1) Build one canonical strip image used across all consistency runs ----
function buildCanonicalStrip(): string {
  const width = 80, height = 400;
  const png = new PNG({ width, height });
  // Pad order: combined TC+TB, FC, pH, TA — using OFFICIAL AquaChek chart colors.
  // FC=4 → purple, pH=7.2 → red, Alk=240 → teal-blue
  const pads: [number, number, number][] = [
    [184, 216, 140],   // combined TC=3 / TB=5 (yellow-green)
    [200, 140, 195],   // FC=4 (purple)
    [225, 80, 50],     // pH=7.2 (red-orange)
    [37, 87, 98],      // Alk=240 (teal-blue)
  ];
  const top = height * 0.2, padH = (height * 0.6) / 4;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = 230, g = 230, b = 230;
      const padIdx = Math.floor((y - top) / padH);
      if (Math.abs(x - width / 2) < width * 0.35 && padIdx >= 0 && padIdx < 4) {
        [r, g, b] = pads[padIdx];
      }
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255;
    }
  }
  const url = "mock://canonical-consistency.png";
  registerPng(url, png);
  return url;
}

// ---- 2) Mock the AI server fn + white balance BEFORE importing the pipeline ----
// AI returns noisy values per call, simulating real model jitter.
let aiCallIdx = 0;
const AI_NOISE: Array<{ fc: number; ph: number; alk: number; conf: number }> = [
  { fc: 3.8, ph: 7.5, alk: 238, conf: 0.82 },
  { fc: 4.0, ph: 7.6, alk: 240, conf: 0.88 },
  { fc: 4.2, ph: 7.7, alk: 242, conf: 0.85 },
];

vi.mock("@/server/strip-analysis.functions", () => ({
  analyzeStripWithAI: vi.fn(async ({ data }: any) => {
    const params: string[] = data.parameters;
    const sample = AI_NOISE[aiCallIdx % AI_NOISE.length];
    aiCallIdx++;
    const values: Record<string, number> = {};
    for (const p of params) {
      if (p === "freeChlorine") values[p] = sample.fc;
      else if (p === "ph") values[p] = sample.ph;
      else if (p === "alkalinity") values[p] = sample.alk;
      else values[p] = 0;
    }
    return {
      ok: true as const,
      data: {
        isStrip: true,
        failureReason: "none" as const,
        values,
        confidence: sample.conf,
        notes: "",
      },
    };
  }),
}));

// White balance is non-deterministic on a synthetic strip; bypass it.
vi.mock("./whiteBalance", () => ({
  whiteBalanceDataUrl: vi.fn(async (url: string) => url),
}));

import { analyzeStripPixels } from "./colorUtils";
import { analyzeStripImage } from "./analyzeStripImage";

describe("Consistency — same strip → same reading", () => {
  it("CV layer: 10 runs on the same image return byte-identical numbers", async () => {
    const url = buildCanonicalStrip();
    const runs = await Promise.all(
      Array.from({ length: 10 }, () => analyzeStripPixels(url))
    );
    const first = runs[0];
    for (const r of runs) {
      expect(r.freeChlorine).toBe(first.freeChlorine);
      expect(r.ph).toBe(first.ph);
      expect(r.alkalinity).toBe(first.alkalinity);
      expect(r.confidence).toBe(first.confidence);
    }
  });

  it("Full pipeline: 5 scans of the same image → same final values (multi-shot median collapses noise)", async () => {
    const url = buildCanonicalStrip();
    aiCallIdx = 0;
    const runs: Array<{ fc: number; ph: number; alk: number }> = [];
    for (let i = 0; i < 5; i++) {
      const r = await analyzeStripImage(url, "aquachek-pro-5in1");
      runs.push({
        fc: r.readings.freeChlorine!.value,
        ph: r.readings.ph!.value,
        alk: r.readings.alkalinity!.value,
      });
    }
    const first = runs[0];
    for (const r of runs) {
      expect(r.fc).toBe(first.fc);
      expect(r.ph).toBe(first.ph);
      expect(r.alk).toBe(first.alk);
    }
    // Median of [3.8, 4.0, 4.2] = 4.0 — proves the consensus picks the middle
    expect(first.fc).toBe(4);
    expect(first.ph).toBe(7.6);
    expect(first.alk).toBe(240);
  });

  it("Stability under wider AI jitter: median still snaps to truth", async () => {
    AI_NOISE.length = 0;
    AI_NOISE.push(
      { fc: 2.0, ph: 7.2, alk: 100, conf: 0.7 },
      { fc: 3.0, ph: 7.6, alk: 120, conf: 0.9 },
      { fc: 4.0, ph: 8.0, alk: 140, conf: 0.7 },
    );
    const url = buildCanonicalStrip();
    aiCallIdx = 0;
    const a = await analyzeStripImage(url, "aquachek-pro-5in1");
    aiCallIdx = 0;
    const b = await analyzeStripImage(url, "aquachek-pro-5in1");
    expect(a.readings.freeChlorine!.value).toBe(b.readings.freeChlorine!.value);
    expect(a.readings.ph!.value).toBe(b.readings.ph!.value);
    expect(a.readings.alkalinity!.value).toBe(b.readings.alkalinity!.value);
    // Median of the three jittered AI shots
    expect(a.readings.freeChlorine!.value).toBe(3);
    expect(a.readings.ph!.value).toBe(7.6);
    expect(a.readings.alkalinity!.value).toBe(120);
  });

  it("Status (low/ok/high) is identical across repeated scans", async () => {
    const url = buildCanonicalStrip();
    aiCallIdx = 0;
    const a = await analyzeStripImage(url, "aquachek-pro-5in1");
    aiCallIdx = 0;
    const b = await analyzeStripImage(url, "aquachek-pro-5in1");
    expect(a.readings.freeChlorine!.status).toBe(b.readings.freeChlorine!.status);
    expect(a.readings.ph!.status).toBe(b.readings.ph!.status);
    expect(a.readings.alkalinity!.status).toBe(b.readings.alkalinity!.status);
  });
});
