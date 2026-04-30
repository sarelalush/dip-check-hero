// Client-side fallback: sample pixel colors from a strip image and match to AquaChek reference chart.
// Reference RGB values are approximations of typical AquaChek 5-in-1 strip colors per parameter level.

interface ColorRef { value: number; rgb: [number, number, number] }

// Approximate reference colors for each pad (R,G,B) at known concentration values.
// These are MVP estimates — calibrate with real strip photos for better accuracy.
const REFS = {
  freeChlorine: [
    { value: 0, rgb: [255, 255, 230] },
    { value: 0.5, rgb: [255, 240, 180] },
    { value: 1, rgb: [255, 220, 140] },
    { value: 3, rgb: [255, 180, 100] },
    { value: 5, rgb: [240, 130, 70] },
    { value: 10, rgb: [200, 80, 50] },
  ] as ColorRef[],
  ph: [
    { value: 6.2, rgb: [240, 200, 100] },
    { value: 6.8, rgb: [240, 160, 90] },
    { value: 7.2, rgb: [230, 110, 90] },
    { value: 7.6, rgb: [210, 80, 100] },
    { value: 7.8, rgb: [180, 60, 100] },
    { value: 8.4, rgb: [150, 40, 100] },
  ] as ColorRef[],
  alkalinity: [
    { value: 0, rgb: [240, 230, 100] },
    { value: 40, rgb: [180, 200, 110] },
    { value: 80, rgb: [120, 170, 130] },
    { value: 120, rgb: [80, 140, 130] },
    { value: 180, rgb: [50, 110, 130] },
    { value: 240, rgb: [30, 80, 120] },
  ] as ColorRef[],
};

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // sRGB -> linear
  const f = (v: number) => {
    v /= 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  };
  const R = f(r), G = f(g), B = f(b);
  // linear RGB -> XYZ (D65)
  const X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  // XYZ -> Lab
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
  // Linear interpolation between best and second-best
  const total = bestD + secondD;
  const w = total > 0 ? secondD / total : 1;
  const value = best.value * w + second.value * (1 - w);
  return { value, distance: bestD };
}

/**
 * Sample average color from a rectangular region of an image.
 */
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
  freeChlorine: number;
  ph: number;
  alkalinity: number;
  confidence: number;
}

/**
 * Analyze the strip image assuming the strip is positioned vertically in the center
 * of the image with pads stacked top-to-bottom in this order:
 *   [free chlorine, pH, alkalinity]
 * (additional pads ignored for MVP)
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

  // Assume strip in center vertical band, taking middle 60% of height divided into 3 pads
  const cx = canvas.width / 2;
  const top = canvas.height * 0.2;
  const padH = (canvas.height * 0.6) / 3;
  const sampleW = Math.max(20, canvas.width * 0.05);
  const sampleH = Math.max(20, padH * 0.5);

  const padCenters = [0, 1, 2].map((i) => top + padH * (i + 0.5));
  const [fcRgb, phRgb, alkRgb] = padCenters.map((cy) =>
    sampleRegion(ctx, cx, cy, sampleW, sampleH),
  );

  const fc = bestMatch(fcRgb, REFS.freeChlorine);
  const ph = bestMatch(phRgb, REFS.ph);
  const alk = bestMatch(alkRgb, REFS.alkalinity);

  // Confidence inversely proportional to color distance
  const avgD = (fc.distance + ph.distance + alk.distance) / 3;
  const confidence = Math.max(0, Math.min(1, 1 - avgD / 50));

  return {
    freeChlorine: +fc.value.toFixed(1),
    ph: +ph.value.toFixed(1),
    alkalinity: Math.round(alk.value),
    confidence,
  };
}
