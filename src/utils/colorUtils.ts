// Client-side fallback: sample pixel colors from a strip image and match to the
// OFFICIAL AquaChek Pro 5-in-1 reference chart.
//
// Strip layout (printed top → bottom):
//   1. Total Chlorine    (yellow → green)
//   2. Total Bromine     (yellow → green, same chart as TC)
//   3. Free Chlorine     (cream → purple)        ← was wrongly orange/red before
//   4. pH                (orange → red)
//   5. Total Alkalinity  (yellow → dark teal)
//
// Reference RGB values were sampled directly from the official AquaChek
// printed color chart (https://www.masterspaparts.com/aquachek-color-chart/).

interface ColorRef { value: number; rgb: [number, number, number] }

// Total chlorine and total bromine share the same yellow→green chart.
const TC_TB_REFS: ColorRef[] = [
  { value: 0,   rgb: [254, 254, 168] },
  { value: 0.5, rgb: [242, 254, 170] },
  { value: 1,   rgb: [231, 245, 160] },
  { value: 3,   rgb: [184, 216, 140] },
  { value: 5,   rgb: [144, 198, 120] },
  { value: 10,  rgb: [76,  163, 95]  },
];

const REFS = {
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

export interface ClientCvResult {
  /** AquaChek Pro 5-in-1 readings. Older 3-pad code can keep using fc/ph/alk. */
  totalChlorine: number;
  bromine: number;
  freeChlorine: number;
  ph: number;
  alkalinity: number;
  confidence: number;
}

/**
 * Read the 5 colored pads of an AquaChek Pro strip and match each one to its
 * official reference chart. Pads are stacked top-to-bottom in this order:
 *   [Total Chlorine, Total Bromine, Free Chlorine, pH, Total Alkalinity]
 *
 * The strip is assumed to be roughly centered horizontally and to occupy the
 * middle 60% of the image vertically.
 */
export async function analyzeStripPixels(imageDataUrl: string): Promise<ClientCvResult> {
  const img = new Image();
  img.src = imageDataUrl;
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const cx = canvas.width / 2;
  const top = canvas.height * 0.2;
  const PAD_COUNT = 5;
  const padH = (canvas.height * 0.6) / PAD_COUNT;
  const sampleW = Math.max(20, canvas.width * 0.05);
  const sampleH = Math.max(20, padH * 0.5);

  const padRgbs = Array.from({ length: PAD_COUNT }, (_, i) => {
    const cy = top + padH * (i + 0.5);
    return sampleRegion(ctx, cx, cy, sampleW, sampleH);
  });

  const tc  = bestMatch(padRgbs[0], REFS.totalChlorine);
  const br  = bestMatch(padRgbs[1], REFS.bromine);
  const fc  = bestMatch(padRgbs[2], REFS.freeChlorine);
  const ph  = bestMatch(padRgbs[3], REFS.ph);
  const alk = bestMatch(padRgbs[4], REFS.alkalinity);

  const avgD = (tc.distance + br.distance + fc.distance + ph.distance + alk.distance) / 5;
  const confidence = Math.max(0, Math.min(1, 1 - avgD / 50));

  return {
    totalChlorine: +tc.value.toFixed(1),
    bromine: +br.value.toFixed(1),
    freeChlorine: +fc.value.toFixed(1),
    ph: +ph.value.toFixed(1),
    alkalinity: Math.round(alk.value),
    confidence,
  };
}
