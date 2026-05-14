// Auto-detects the test strip in a photo and places it centered on a clean
// white background. This dramatically improves AI color reading accuracy by
// removing background distractions (table, hand, pool deck, etc.).
//
// Heuristic: the strip pads are highly saturated colored regions. We compute
// a saturation map, find the bounding box of saturated pixels, pad it, then
// composite onto a white canvas.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export interface IsolateOptions {
  /** Output canvas width (px). Default 640. */
  outWidth?: number;
  /** Output canvas height (px). Default 800. */
  outHeight?: number;
  /** Padding around the strip (px). Default 60. */
  padding?: number;
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

  // Downscale for analysis — speeds up bbox detection on large photos.
  const ANALYSIS_MAX = 600;
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

  let minX = aw;
  let minY = ah;
  let maxX = 0;
  let maxY = 0;
  let found = 0;

  // Threshold — pads usually have saturation > 0.25 and aren't too dark.
  const SAT_THRESH = 0.22;
  for (let y = 0; y < ah; y++) {
    for (let x = 0; x < aw; x++) {
      const i = (y * aw + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      if (sat > SAT_THRESH && max > 70 && max < 250) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        found++;
      }
    }
  }

  // Map bbox back to original image coordinates, with a generous pad
  // (the strip usually extends a bit beyond the saturated pads — handle).
  let cropX: number;
  let cropY: number;
  let cropW: number;
  let cropH: number;

  const totalPixels = aw * ah;
  // Need enough saturated pixels (>0.4%) AND reasonable bbox to trust it.
  if (
    found > totalPixels * 0.004 &&
    maxX > minX + 10 &&
    maxY > minY + 10
  ) {
    const bw = maxX - minX;
    const bh = maxY - minY;
    const padX = Math.round(bw * 0.4) + 8;
    const padY = Math.round(bh * 0.2) + 8;
    const pMinX = Math.max(0, minX - padX);
    const pMinY = Math.max(0, minY - padY);
    const pMaxX = Math.min(aw - 1, maxX + padX);
    const pMaxY = Math.min(ah - 1, maxY + padY);
    cropX = Math.round(pMinX / aScale);
    cropY = Math.round(pMinY / aScale);
    cropW = Math.round((pMaxX - pMinX) / aScale);
    cropH = Math.round((pMaxY - pMinY) / aScale);
  } else {
    // Fallback: assume the user roughly centered the strip.
    cropW = Math.round(w * 0.42);
    cropH = Math.round(h * 0.78);
    cropX = Math.round((w - cropW) / 2);
    cropY = Math.round((h - cropH) / 2);
  }

  // Compose onto white canvas.
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
