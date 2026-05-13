// Realistic pool scenarios for AquaChek Pro 5-in-1 (TC, TB, FC, pH, TA).
// Uses the OFFICIAL chart colors sampled from the AquaChek printed chart.
import { describe, it, expect, beforeAll } from "vitest";
import { PNG } from "pngjs";
import { installCanvasMock, registerPng } from "./__fixtures__/canvasMock";

beforeAll(() => {
  installCanvasMock();
});

import { analyzeStripPixels } from "./colorUtils";
import { targetRanges } from "@/config/targetRanges";
import { getBrand, DEFAULT_BRAND_ID } from "@/config/stripBrands";

const TC_TB = [
  { value: 0, rgb: [254, 254, 168] },
  { value: 0.5, rgb: [242, 254, 170] },
  { value: 1, rgb: [231, 245, 160] },
  { value: 3, rgb: [184, 216, 140] },
  { value: 5, rgb: [144, 198, 120] },
  { value: 10, rgb: [76, 163, 95] },
] as const;

const REFS = {
  totalChlorine: TC_TB,
  bromine: TC_TB,
  freeChlorine: [
    { value: 0, rgb: [254, 254, 204] },
    { value: 0.5, rgb: [247, 249, 225] },
    { value: 1, rgb: [230, 223, 215] },
    { value: 3, rgb: [172, 139, 208] },
    { value: 5, rgb: [158, 106, 189] },
    { value: 10, rgb: [129, 29, 153] },
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

function buildAquachekProStrip(id: string, fc: number, ph: number, alk: number): string {
  const width = 80, height = 400;
  const png = new PNG({ width, height });
  // Pad order: TC, TB, FC, pH, TA. Use FC as proxy for TC; bromine pad pale.
  const pads: RGB[] = [
    colorForValue(REFS.totalChlorine, fc),
    colorForValue(REFS.bromine, 0),
    colorForValue(REFS.freeChlorine, fc),
    colorForValue(REFS.ph, ph),
    colorForValue(REFS.alkalinity, alk),
  ];
  const top = height * 0.2;
  const padH = (height * 0.6) / 5;
  const cx = width / 2;
  const halfW = width * 0.35;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = 230, g = 230, b = 230;
      const inStrip = Math.abs(x - cx) < halfW;
      const padIdx = Math.floor((y - top) / padH);
      if (inStrip && padIdx >= 0 && padIdx < 5) {
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
  fc: number; ph: number; alk: number;
  expect: { fcStatus: "low" | "ok" | "high"; phStatus: "low" | "ok" | "high"; alkStatus: "low" | "ok" | "high" };
}

function statusOf(v: number, key: "freeChlorine" | "ph" | "alkalinity") {
  const r = targetRanges[key];
  if (!r) return "ok";
  if (v < r.min) return "low";
  if (v > r.max) return "high";
  return "ok";
}

const SCENARIOS: Scenario[] = [
  { name: "בריכה מאוזנת לחלוטין", fc: 3, ph: 7.2, alk: 120, expect: { fcStatus: "ok", phStatus: "ok", alkStatus: "ok" } },
  { name: "כלור נמוך — צריך להוסיף כלור", fc: 0.5, ph: 7.2, alk: 120, expect: { fcStatus: "low", phStatus: "ok", alkStatus: "ok" } },
  { name: "כלור גבוה מדי — אזהרה", fc: 8, ph: 7.2, alk: 120, expect: { fcStatus: "high", phStatus: "ok", alkStatus: "ok" } },
  { name: "pH נמוך — בריכה חומצית", fc: 3, ph: 6.8, alk: 120, expect: { fcStatus: "ok", phStatus: "low", alkStatus: "ok" } },
  { name: "אלקליניות נמוכה — pH לא יציב", fc: 3, ph: 7.2, alk: 40, expect: { fcStatus: "ok", phStatus: "ok", alkStatus: "low" } },
  { name: "אלקליניות גבוהה — קושי בהורדת pH", fc: 3, ph: 7.2, alk: 200, expect: { fcStatus: "ok", phStatus: "ok", alkStatus: "high" } },
  { name: "כלור-שוק לאחר טיפול", fc: 10, ph: 7.2, alk: 100, expect: { fcStatus: "high", phStatus: "ok", alkStatus: "ok" } },
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

      expect(Math.abs(r.freeChlorine! - s.fc)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.ph! - s.ph)).toBeLessThanOrEqual(0.4);
      expect(Math.abs(r.alkalinity! - s.alk)).toBeLessThanOrEqual(30);

      expect(statusOf(r.freeChlorine!, "freeChlorine")).toBe(s.expect.fcStatus);
      expect(statusOf(r.ph!, "ph")).toBe(s.expect.phStatus);
      expect(statusOf(r.alkalinity!, "alkalinity")).toBe(s.expect.alkStatus);

      expect(r.confidence).toBeGreaterThan(0.7);
    });
  }

  it("חזרתיות מלאה — שני סטיקים זהים נותנים אותה תשובה", async () => {
    const a = await analyzeStripPixels(buildAquachekProStrip("rep-a", 3, 7.2, 120));
    const b = await analyzeStripPixels(buildAquachekProStrip("rep-b", 3, 7.2, 120));
    expect(a.freeChlorine).toBe(b.freeChlorine);
    expect(a.ph).toBe(b.ph);
    expect(a.alkalinity).toBe(b.alkalinity);
  });

  it("מבחין בין סטיק תקין לסטיק עם כלור גבוה", async () => {
    const ok = await analyzeStripPixels(buildAquachekProStrip("ok", 3, 7.2, 120));
    const high = await analyzeStripPixels(buildAquachekProStrip("hi", 8, 7.2, 120));
    expect(high.freeChlorine).toBeGreaterThan(ok.freeChlorine! + 2);
  });
});
