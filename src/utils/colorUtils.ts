// Client-side fallback: sample pixel colors from a strip image and match to
// the OFFICIAL AquaChek reference charts.
//
// Two brands are supported here:
//
// AquaChek Yellow 4-in-1 (DEFAULT) — pads top→bottom on the bottle:
//   1. Free Chlorine     (white → pink → purple/magenta)
//   2. pH                (yellow → orange → red)
//   3. Total Alkalinity  (yellow-green → green → teal)
//   4. Cyanuric Acid     (white turbidity → tan/gray)
//
// AquaChek Pro 5-in-1 — pads top→bottom:
//   1. Total Chlorine    (yellow → green)
//   2. Total Bromine     (yellow → green, same chart as TC)
//   3. Free Chlorine     (cream → purple)
//   4. pH                (orange → red)
//   5. Total Alkalinity  (yellow → dark teal)

interface ColorRef { value: number; rgb: [number, number, number] }

// ---------- Pro 5-in-1 references ----------
const TC_TB_REFS: ColorRef[] = [
  { value: 0,   rgb: [254, 254, 168] },
  { value: 0.5, rgb: [242, 254, 170] },
  { value: 1,   rgb: [231, 245, 160] },
  { value: 3,   rgb: [184, 216, 140] },
  { value: 5,   rgb: [144, 198, 120] },
  { value: 10,  rgb: [76,  163, 95]  },
];

const PRO_REFS = {
  totalChlorine: TC_TB_REFS,
  bromine: TC_TB_REFS,
  freeChlorine: [
    { value: 0,   rgb: [254, 254, 204] },
    { value: 0.5, rgb: [247, 249, 225] },
    { value: 1,   rgb: [230, 223, 215] },
    { value: 3,   rgb: [172, 139, 208] },
    { value: 5,   rgb: [158, 106, 189] },
    { value: 10,  rgb: [129, 29,  153] },
  ] as ColorRef[],
  ph: [
    { value: 6.2, rgb: [242, 175, 60]  },
    { value: 6.8, rgb: [234, 106, 45]  },
    { value: 7.2, rgb: [225, 80,  50]  },
    { value: 7.8, rgb: [210, 55,  45]  },
    { value: 8.4, rgb: [180, 45,  45]  },
  ] as ColorRef[],
  alkalinity: [
    { value: 0,   rgb: [227, 192, 64] },
    { value: 40,  rgb: [164, 169, 51] },
    { value: 80,  rgb: [137, 159, 58] },
    { value: 120, rgb: [72,  111, 54] },
    { value: 180, rgb: [35,  82,  46] },
    { value: 240, rgb: [37,  87,  98] },
  ] as ColorRef[],
};

// ---------- Yellow 4-in-1 references ----------
const YELLOW_REFS = {
  freeChlorine: [
    { value: 0,   rgb: [248, 245, 230] },
    { value: 1,   rgb: [240, 205, 215] },
    { value: 3,   rgb: [228, 150, 180] },
    { value: 5,   rgb: [200, 95,  150] },
    { value: 10,  rgb: [135, 40,  115] },
  ] as ColorRef[],
  ph: [
    { value: 6.2, rgb: [245, 225, 90]  },
    { value: 6.8, rgb: [240, 180, 80]  },
    { value: 7.2, rgb: [235, 135, 75]  },
    { value: 7.8, rgb: [220, 90,  70]  },
    { value: 8.4, rgb: [180, 55,  55]  },
  ] as ColorRef[],
  alkalinity: [
    { value: 0,   rgb: [235, 210, 80]  },
    { value: 40,  rgb: [190, 200, 90]  },
    { value: 80,  rgb: [140, 185, 100] },
    { value: 120, rgb: [100, 165, 100] },
    { value: 180, rgb: [50,  130, 90]  },
    { value: 240, rgb: [35,  110, 120] },
  ] as ColorRef[],
  cyanuricAcid: [
    { value: 0,   rgb: [240, 240, 235] },
    { value: 30,  rgb: [220, 215, 200] },
    { value: 50,  rgb: [195, 190, 180] },
    { value: 100, rgb: [165, 155, 140] },
    { value: 150, rgb: [120, 110, 100] },
  ] as ColorRef[],
};

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const f = (v: number) => {
    v /= 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  };
  const R = f(r), G = f(g), B = f(b);
  const X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
  const fxyz = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = fxyz(X / Xn), fy = fxyz(Y / Yn), fz = fxyz(Z / Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(c1: [number, number, number], c2: [number, number, number]) {
  return Math.sqrt((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2);
}

function bestMatch(rgb: [number, number, number], refs: ColorRef[]) {
  const lab = rgbToLab(...rgb);
  let best = refs[0], bestD = Infinity, second = refs[0], secondD = Infinity;
  for (const r of refs) {
    const d = deltaE(lab, rgbToLab(...r.rgb));
    if (d < bestD) { secondD = bestD; second = best; bestD = d; best = r; }
    else if (d < secondD) { secondD = d; second = r; }
  }
  const total = bestD + secondD;
  const w = total > 0 ? secondD / total : 1;
  const value = best.value * w + second.value * (1 - w);
  return { value, distance: bestD };
}

function sampleRegion(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number, h: number,
): [number, number, number] {
  const data = ctx.getImageData(cx - w / 2, cy - h / 2, w, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  return [r / n, g / n, b / n];
}

async function loadCanvas(imageDataUrl: string) {
  const img = new Image();
  img.src = imageDataUrl;
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return { canvas, ctx };
}

function samplePads(
  ctx: CanvasRenderingContext2D,
  width: number, height: number, padCount: number,
) {
  const cx = width / 2;
  const top = height * 0.2;
  const padH = (height * 0.6) / padCount;
  const sampleW = Math.max(20, width * 0.05);
  const sampleH = Math.max(20, padH * 0.5);
  return Array.from({ length: padCount }, (_, i) => {
    const cy = top + padH * (i + 0.5);
    return sampleRegion(ctx, cx, cy, sampleW, sampleH);
  });
}

export interface ClientCvResult {
  totalChlorine?: number;
  bromine?: number;
  freeChlorine?: number;
  ph?: number;
  alkalinity?: number;
  cyanuricAcid?: number;
  confidence: number;
}

/** AquaChek Pro 5-in-1: 5 pads (TC, TB, FC, pH, TA). */
export async function analyzeStripPixels(imageDataUrl: string): Promise<ClientCvResult> {
  const { canvas, ctx } = await loadCanvas(imageDataUrl);
  const pads = samplePads(ctx, canvas.width, canvas.height, 5);
  const tc  = bestMatch(pads[0], PRO_REFS.totalChlorine);
  const br  = bestMatch(pads[1], PRO_REFS.bromine);
  const fc  = bestMatch(pads[2], PRO_REFS.freeChlorine);
  const ph  = bestMatch(pads[3], PRO_REFS.ph);
  const alk = bestMatch(pads[4], PRO_REFS.alkalinity);
  const avgD = (tc.distance + br.distance + fc.distance + ph.distance + alk.distance) / 5;
  return {
    totalChlorine: +tc.value.toFixed(1),
    bromine: +br.value.toFixed(1),
    freeChlorine: +fc.value.toFixed(1),
    ph: +ph.value.toFixed(1),
    alkalinity: Math.round(alk.value),
    confidence: Math.max(0, Math.min(1, 1 - avgD / 50)),
  };
}

/** AquaChek Yellow 4-in-1: 4 pads (FC, pH, TA, CYA). */
export async function analyzeStripPixelsYellow(imageDataUrl: string): Promise<ClientCvResult> {
  const { canvas, ctx } = await loadCanvas(imageDataUrl);
  const pads = samplePads(ctx, canvas.width, canvas.height, 4);
  const fc  = bestMatch(pads[0], YELLOW_REFS.freeChlorine);
  const ph  = bestMatch(pads[1], YELLOW_REFS.ph);
  const alk = bestMatch(pads[2], YELLOW_REFS.alkalinity);
  const cya = bestMatch(pads[3], YELLOW_REFS.cyanuricAcid);
  const avgD = (fc.distance + ph.distance + alk.distance + cya.distance) / 4;
  return {
    freeChlorine: +fc.value.toFixed(1),
    ph: +ph.value.toFixed(1),
    alkalinity: Math.round(alk.value),
    cyanuricAcid: Math.round(cya.value),
    confidence: Math.max(0, Math.min(1, 1 - avgD / 50)),
  };
}
