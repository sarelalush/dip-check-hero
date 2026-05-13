// Realistic pool scenarios for the AquaChek Pro (5-in-1) demo brand.
// Each "strip" represents a real-world pool condition. We build a synthetic
// fixture matching the expected pad colors and verify analyzeStripPixels
// returns readings + status that match what a pool owner would see.
import { describe, it, expect, beforeAll } from "vitest";
import { PNG } from "pngjs";
import { installCanvasMock, registerPng } from "./__fixtures__/canvasMock";

beforeAll(() => {
  installCanvasMock();
});

import { analyzeStripPixels } from "./colorUtils";
import { targetRanges } from "@/config/targetRanges";
import { getBrand, DEFAULT_BRAND_ID } from "@/config/stripBrands";

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
function colorForValue(refs: readonly { value: number; rgb: readonly number[] }[], v: number): RGB {
  if (v <= refs[0].value) return refs[0].rgb as unknown as RGB;
  if (v >= refs[refs.length - 1].value) return refs[refs.length - 1].rgb as unknown as RGB;
  for (let i = 0; i < refs.length - 1; i++) {
    const a = refs[i], b = refs[i + 1];
    if (v >= a.value && v <= b.value) {
      return lerpRgb(a.rgb, b.rgb, (v - a.value) / (b.value - a.value));
    }
  }
  return refs[refs.length - 1].rgb as unknown as RGB;
}

/**
 * Build an AquaChek Pro strip fixture. The Pro has 5 pads but the local CV
 * analyzer reads the 3 chemically-meaningful color pads (FC / pH / Alk).
 * That mirrors how the app uses analyzeStripPixels as a CV fallback.
 */
function buildAquachekProStrip(id: string, fc: number, ph: number, alk: number): string {
  const width = 80, height = 320;
  const png = new PNG({ width, height });
  const pads: RGB[] = [
    colorForValue(REFS.freeChlorine, fc),
    colorForValue(REFS.ph, ph),
    colorForValue(REFS.alkalinity, alk),
  ];
  const top = height * 0.2;
  const padH = (height * 0.6) / 3;
  const cx = width / 2;
  const halfW = width * 0.35;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = 230, g = 230, b = 230;
      const inStrip = Math.abs(x - cx) < halfW;
      const padIdx = Math.floor((y - top) / padH);
      if (inStrip && padIdx >= 0 && padIdx < 3) {
        const c = pads[padIdx];
        r = c[0]; g = c[1]; b = c[2];
      }
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255;
    }
  }
  const url = `mock://aquachekpro-${id}.png`;
  registerPng(url, png);
  return url;
}

interface Scenario {
  name: string;
  fc: number;
  ph: number;
  alk: number;
  expect: {
    fcStatus: "low" | "ok" | "high";
    phStatus: "low" | "ok" | "high";
    alkStatus: "low" | "ok" | "high";
  };
}

function statusOf(v: number, key: "freeChlorine" | "ph" | "alkalinity") {
  const r = targetRanges[key];
  if (!r) return "ok";
  if (v < r.min) return "low";
  if (v > r.max) return "high";
  return "ok";
}

const SCENARIOS: Scenario[] = [
  {
    name: "בריכה מאוזנת לחלוטין",
    fc: 3, ph: 7.6, alk: 120,
    expect: { fcStatus: "ok", phStatus: "ok", alkStatus: "ok" },
  },
  {
    name: "כלור נמוך — צריך להוסיף כלור",
    fc: 0.5, ph: 7.6, alk: 120,
    expect: { fcStatus: "low", phStatus: "ok", alkStatus: "ok" },
  },
  {
    name: "כלור גבוה מדי — אזהרה",
    fc: 8, ph: 7.6, alk: 120,
    expect: { fcStatus: "high", phStatus: "ok", alkStatus: "ok" },
  },
  {
    name: "pH נמוך — בריכה חומצית",
    fc: 3, ph: 6.8, alk: 120,
    expect: { fcStatus: "ok", phStatus: "low", alkStatus: "ok" },
  },
  {
    name: "pH גבוה — בעיית סידן עתידית",
    fc: 3, ph: 8.0, alk: 120,
    expect: { fcStatus: "ok", phStatus: "high", alkStatus: "ok" },
  },
  {
    name: "אלקליניות נמוכה — pH לא יציב",
    fc: 3, ph: 7.6, alk: 40,
    expect: { fcStatus: "ok", phStatus: "ok", alkStatus: "low" },
  },
  {
    name: "אלקליניות גבוהה — קושי בהורדת pH",
    fc: 3, ph: 7.6, alk: 200,
    expect: { fcStatus: "ok", phStatus: "ok", alkStatus: "high" },
  },
  {
    name: "בריכה מוזנחת — הכל לא תקין",
    fc: 0, ph: 8.4, alk: 30,
    expect: { fcStatus: "low", phStatus: "high", alkStatus: "low" },
  },
  {
    name: "כלור-שוק לאחר טיפול",
    fc: 10, ph: 7.2, alk: 100,
    expect: { fcStatus: "high", phStatus: "ok", alkStatus: "ok" },
  },
];

describe("AquaChek Pro (5-in-1) — demo brand registered", () => {
  it("הוא ברירת המחדל בדמו", () => {
    const b = getBrand(DEFAULT_BRAND_ID);
    expect(b.id).toBe("aquachek-pro-5in1");
    expect(b.parameters).toContain("totalChlorine");
    expect(b.parameters).toContain("bromine");
    expect(b.parameters).toContain("freeChlorine");
    expect(b.parameters).toContain("ph");
    expect(b.parameters).toContain("alkalinity");
  });
});

describe("AquaChek Pro — סטיקים שונים מתרחישי בריכה אמיתיים", () => {
  for (const s of SCENARIOS) {
    it(`${s.name} (FC=${s.fc} pH=${s.ph} Alk=${s.alk})`, async () => {
      const url = buildAquachekProStrip(s.name, s.fc, s.ph, s.alk);
      const r = await analyzeStripPixels(url);

      // Numerical accuracy
      expect(Math.abs(r.freeChlorine - s.fc)).toBeLessThanOrEqual(0.7);
      expect(Math.abs(r.ph - s.ph)).toBeLessThanOrEqual(0.4);
      expect(Math.abs(r.alkalinity - s.alk)).toBeLessThanOrEqual(25);

      // Status mapping a pool owner would see in the UI
      expect(statusOf(r.freeChlorine, "freeChlorine")).toBe(s.expect.fcStatus);
      expect(statusOf(r.ph, "ph")).toBe(s.expect.phStatus);
      expect(statusOf(r.alkalinity, "alkalinity")).toBe(s.expect.alkStatus);

      // Confidence should be high — colors come straight from the chart
      expect(r.confidence).toBeGreaterThan(0.7);

      console.log(
        `✓ ${s.name} → FC=${r.freeChlorine}/${s.expect.fcStatus} ` +
        `pH=${r.ph}/${s.expect.phStatus} Alk=${r.alkalinity}/${s.expect.alkStatus} ` +
        `(conf ${r.confidence.toFixed(2)})`
      );
    });
  }

  it("מבחין בין שני סטיקים זהים — חזרתיות מלאה", async () => {
    const a = await analyzeStripPixels(buildAquachekProStrip("rep-a", 3, 7.6, 120));
    const b = await analyzeStripPixels(buildAquachekProStrip("rep-b", 3, 7.6, 120));
    expect(a.freeChlorine).toBe(b.freeChlorine);
    expect(a.ph).toBe(b.ph);
    expect(a.alkalinity).toBe(b.alkalinity);
  });

  it("מבחין בין סטיק תקין לסטיק עם כלור גבוה", async () => {
    const ok = await analyzeStripPixels(buildAquachekProStrip("ok", 3, 7.6, 120));
    const high = await analyzeStripPixels(buildAquachekProStrip("hi", 8, 7.6, 120));
    expect(high.freeChlorine).toBeGreaterThan(ok.freeChlorine + 2);
  });
});
