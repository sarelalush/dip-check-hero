// Auto-detects the test strip in a photo and places it centered on a clean
// white background. Tight crop: only the strip itself, no hand/background.
//
// Approach:
//   1. Build a list of "pad-like" pixels: highly saturated AND not skin-toned.
//   2. Use a percentile bbox (10–90th) so outliers (a colored shirt sleeve,
//      a stray sticker) don't blow up the crop.
//   3. Pad bbox slightly to include the white strip body around the pads,
//      then composite onto a white canvas.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export interface IsolateOptions {
  outWidth?: number;
  outHeight?: number;
  padding?: number;
}

/** Skin-tone heuristic: warm pixels where R is dominant by a small margin. */
function isSkinLike(r: number, g: number, b: number): boolean {
  // Classic skin range: R > G > B, R-B between 15–80, R > 95.
  return r > 95 && g > 40 && b > 20 && r > g && g >= b && r - b > 15 && r - b < 90;
}

export async function isolateStripOnWhite(
  dataUrl: string,
  opts: IsolateOptions = {},
): Promise<string> {
  const outW = opts.outWidth ?? 640;
  const outH = opts.outHeight ?? 800;
  const padding = opts.padding ?? 60;

  const img = await loadImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return dataUrl;

  // Downscale for analysis.
  const ANALYSIS_MAX = 640;
  const aScale = Math.min(1, ANALYSIS_MAX / Math.max(w, h));
  const aw = Math.max(1, Math.round(w * aScale));
  const ah = Math.max(1, Math.round(h * aScale));

  const aCanvas = document.createElement("canvas");
  aCanvas.width = aw;
  aCanvas.height = ah;
  const aCtx = aCanvas.getContext("2d", { willReadFrequently: true });
  if (!aCtx) return dataUrl;
  aCtx.drawImage(img, 0, 0, aw, ah);
  const { data } = aCtx.getImageData(0, 0, aw, ah);

  // Collect coordinates of pad-like pixels.
  const xs: number[] = [];
  const ys: number[] = [];
  const SAT_THRESH = 0.32;
  for (let y = 0; y < ah; y++) {
    for (let x = 0; x < aw; x++) {
      const i = (y * aw + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      if (max < 80 || max > 248) continue; // too dark or blown-out
      if (sat < SAT_THRESH) continue;
      if (isSkinLike(r, g, b)) continue;
      xs.push(x);
      ys.push(y);
    }
  }

  let cropX: number;
  let cropY: number;
  let cropW: number;
  let cropH: number;

  // Need a reasonable cluster of pad pixels (>0.15% of analysis frame).
  if (xs.length > aw * ah * 0.0015 && xs.length > 80) {
    // Percentile bbox — robust to outliers.
    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);
    const pLow = 0.05;
    const pHigh = 0.95;
    const xLo = xs[Math.floor(xs.length * pLow)];
    const xHi = xs[Math.floor(xs.length * pHigh)];
    const yLo = ys[Math.floor(ys.length * pLow)];
    const yHi = ys[Math.floor(ys.length * pHigh)];

    const bw = Math.max(4, xHi - xLo);
    const bh = Math.max(4, yHi - yLo);

    // Strip body extends a bit beyond the colored pads. The pads occupy
    // most of the strip width and ~80% of its length; padding moderately.
    const padX = Math.round(bw * 0.45) + 4;
    const padY = Math.round(bh * 0.12) + 4;

    const pMinX = Math.max(0, xLo - padX);
    const pMinY = Math.max(0, yLo - padY);
    const pMaxX = Math.min(aw - 1, xHi + padX);
    const pMaxY = Math.min(ah - 1, yHi + padY);

    cropX = Math.round(pMinX / aScale);
    cropY = Math.round(pMinY / aScale);
    cropW = Math.round((pMaxX - pMinX) / aScale);
    cropH = Math.round((pMaxY - pMinY) / aScale);
  } else {
    // Fallback: assume the user roughly centered the strip.
    cropW = Math.round(w * 0.35);
    cropH = Math.round(h * 0.7);
    cropX = Math.round((w - cropW) / 2);
    cropY = Math.round((h - cropH) / 2);
  }

  // Compose onto white canvas, fitted with padding.
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const oCtx = out.getContext("2d");
  if (!oCtx) return dataUrl;
  oCtx.fillStyle = "#ffffff";
  oCtx.fillRect(0, 0, outW, outH);

  const availW = outW - padding * 2;
  const availH = outH - padding * 2;
  const scale = Math.min(availW / cropW, availH / cropH);
  const drawW = cropW * scale;
  const drawH = cropH * scale;
  const dx = (outW - drawW) / 2;
  const dy = (outH - drawH) / 2;

  oCtx.drawImage(img, cropX, cropY, cropW, cropH, dx, dy, drawW, drawH);

  return out.toDataURL("image/jpeg", 0.93);
}
