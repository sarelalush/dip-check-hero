// Auto-detects the test strip in a photo and places it centered on a clean
// white background. The crop is orientation-aware and aggressively removes
// hand/floor pixels so the user sees only the strip area.

type Point = { x: number; y: number };

interface Component {
  area: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cx: number;
  cy: number;
  pixels: Point[];
}

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

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/** Skin-tone heuristic: warm pixels where R is dominant by a small margin. */
function isSkinLike(r: number, g: number, b: number): boolean {
  return r > 95 && g > 40 && b > 20 && r > g && g >= b && r - b > 15 && r - b < 90;
}

function isPadLike(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const sat = saturation(r, g, b);
  if (max < 70 || max > 250) return false;
  if (sat < 0.27) return false;
  // Exclude hand tones, but keep very vivid oranges/reds that can be real pH pads.
  if (isSkinLike(r, g, b) && sat < 0.5) return false;
  return true;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const idx = Math.max(0, Math.min(values.length - 1, Math.floor(values.length * p)));
  return values[idx];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 0.5);
}

function findComponents(mask: Uint8Array, width: number, height: number): Component[] {
  const seen = new Uint8Array(mask.length);
  const components: Component[] = [];
  const minArea = Math.max(8, Math.floor(width * height * 0.000025));
  const maxArea = width * height * 0.045;

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;

    const stack = [start];
    seen[start] = 1;
    const pixels: Point[] = [];
    let area = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let sx = 0;
    let sy = 0;

    while (stack.length) {
      const idx = stack.pop()!;
      const x = idx % width;
      const y = Math.floor(idx / width);
      area++;
      sx += x;
      sy += y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      if (pixels.length < 9000) pixels.push({ x, y });

      for (let yy = y - 1; yy <= y + 1; yy++) {
        if (yy < 0 || yy >= height) continue;
        for (let xx = x - 1; xx <= x + 1; xx++) {
          if (xx < 0 || xx >= width || (xx === x && yy === y)) continue;
          const n = yy * width + xx;
          if (mask[n] && !seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }
    }

    const compW = maxX - minX + 1;
    const compH = maxY - minY + 1;
    const isHugeBackground = area > maxArea || compW > width * 0.5 || compH > height * 0.5;
    if (area >= minArea && !isHugeBackground) {
      components.push({ area, minX, maxX, minY, maxY, cx: sx / area, cy: sy / area, pixels });
    }
  }

  return components.sort((a, b) => b.area - a.area).slice(0, 30);
}

function chooseAlignedComponents(
  components: Component[],
  width: number,
  height: number,
): Component[] {
  if (components.length <= 1) return components;

  const sizes = components.map((c) => Math.max(c.maxX - c.minX + 1, c.maxY - c.minY + 1));
  const tolerance = Math.max(8, median(sizes) * 1.25, Math.min(width, height) * 0.022);
  let best: Component[] = [];
  let bestScore = -Infinity;

  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const a = components[i];
      const b = components[j];
      const dx = b.cx - a.cx;
      const dy = b.cy - a.cy;
      const dist = Math.hypot(dx, dy);
      if (dist < Math.min(width, height) * 0.035) continue;

      const ux = dx / dist;
      const uy = dy / dist;
      const group = components.filter(
        (c) => Math.abs((c.cx - a.cx) * -uy + (c.cy - a.cy) * ux) <= tolerance,
      );
      if (group.length < 2) continue;

      const ts = group.map((c) => c.cx * ux + c.cy * uy);
      const range = Math.max(...ts) - Math.min(...ts);
      const totalArea = group.reduce((sum, c) => sum + c.area, 0);
      const centerPenalty =
        Math.hypot(
          group.reduce((sum, c) => sum + c.cx, 0) / group.length - width / 2,
          group.reduce((sum, c) => sum + c.cy, 0) / group.length - height / 2,
        ) * 0.2;
      const score = group.length * 1200 + range * 4 + totalArea * 0.08 - centerPenalty;
      if (score > bestScore) {
        bestScore = score;
        best = group;
      }
    }
  }

  return best.length ? best : components.slice(0, Math.min(5, components.length));
}

function axisFromComponents(components: Component[]): { ux: number; uy: number; angle: number } {
  if (components.length >= 2) {
    let totalWeight = 0;
    let mx = 0;
    let my = 0;
    for (const c of components) {
      const weight = Math.sqrt(c.area);
      totalWeight += weight;
      mx += c.cx * weight;
      my += c.cy * weight;
    }
    mx /= totalWeight;
    my /= totalWeight;

    let xx = 0;
    let xy = 0;
    let yy = 0;
    for (const c of components) {
      const weight = Math.sqrt(c.area);
      const dx = c.cx - mx;
      const dy = c.cy - my;
      xx += weight * dx * dx;
      xy += weight * dx * dy;
      yy += weight * dy * dy;
    }
    const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
    return { ux: Math.cos(angle), uy: Math.sin(angle), angle };
  }

  const c = components[0];
  const vertical = c.maxY - c.minY >= c.maxX - c.minX;
  const angle = vertical ? Math.PI / 2 : 0;
  return { ux: Math.cos(angle), uy: Math.sin(angle), angle };
}

function cleanExtractedBackground(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const sat = saturation(r, g, b);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const paper = luma > 155 && sat < 0.32;
    const vividPad = sat > 0.22 && luma > 45 && !(isSkinLike(r, g, b) && sat < 0.5);

    if (!paper && !vividPad) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

export async function isolateStripOnWhite(
  dataUrl: string,
  opts: IsolateOptions = {},
): Promise<string> {
  const outW = opts.outWidth ?? 640;
  const outH = opts.outHeight ?? 800;
  const padding = opts.padding ?? 56;

  const img = await loadImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return dataUrl;

  const ANALYSIS_MAX = 720;
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

  const mask = new Uint8Array(aw * ah);
  for (let y = 0; y < ah; y++) {
    for (let x = 0; x < aw; x++) {
      const i = (y * aw + x) * 4;
      if (isPadLike(data[i], data[i + 1], data[i + 2])) mask[y * aw + x] = 1;
    }
  }

  const components = findComponents(mask, aw, ah);
  const aligned = chooseAlignedComponents(components, aw, ah);

  let sourceCanvas: HTMLCanvasElement | null = null;
  if (aligned.length) {
    const { ux, uy, angle } = axisFromComponents(aligned);
    const sx = -uy;
    const sy = ux;
    const points = aligned.flatMap((c) => c.pixels);
    const ts = points.map((p) => p.x * ux + p.y * uy).sort((a, b) => a - b);
    const ss = points.map((p) => p.x * sx + p.y * sy).sort((a, b) => a - b);

    const tLo = percentile(ts, 0.02);
    const tHi = percentile(ts, 0.98);
    const sLo = percentile(ss, 0.04);
    const sHi = percentile(ss, 0.96);
    const tMid = (tLo + tHi) / 2;
    const sMid = (sLo + sHi) / 2;
    const padLength = Math.max(12, tHi - tLo);
    const padWidth = Math.max(8, sHi - sLo);
    const stripWidth = Math.max(padWidth * 1.75, Math.min(aw, ah) * 0.045);
    const stripLength = Math.max(padLength + stripWidth * 2.1, stripWidth * 3.2);

    const centerX = (tMid * ux + sMid * sx) / aScale;
    const centerY = (tMid * uy + sMid * sy) / aScale;
    const rectW = Math.max(24, Math.round(stripWidth / aScale));
    const rectH = Math.max(60, Math.round(stripLength / aScale));

    sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = rectW;
    sourceCanvas.height = rectH;
    const sCtx = sourceCanvas.getContext("2d");
    if (sCtx) {
      sCtx.fillStyle = "#ffffff";
      sCtx.fillRect(0, 0, rectW, rectH);
      sCtx.translate(rectW / 2, rectH / 2);
      sCtx.rotate(Math.PI / 2 - angle);
      sCtx.drawImage(img, -centerX, -centerY);
      cleanExtractedBackground(sourceCanvas);
    }
  }

  // Fallback: never show a large area of floor/hand; use a narrow central crop.
  if (!sourceCanvas) {
    const cropW = Math.round(w * 0.28);
    const cropH = Math.round(h * 0.72);
    sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = cropW;
    sourceCanvas.height = cropH;
    const fCtx = sourceCanvas.getContext("2d");
    if (fCtx) {
      fCtx.fillStyle = "#ffffff";
      fCtx.fillRect(0, 0, cropW, cropH);
      fCtx.drawImage(img, (w - cropW) / 2, (h - cropH) / 2, cropW, cropH, 0, 0, cropW, cropH);
      cleanExtractedBackground(sourceCanvas);
    }
  }

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const oCtx = out.getContext("2d");
  if (!oCtx) return dataUrl;
  oCtx.fillStyle = "#ffffff";
  oCtx.fillRect(0, 0, outW, outH);

  const availW = outW - padding * 2;
  const availH = outH - padding * 2;
  const scale = Math.min(availW / sourceCanvas.width, availH / sourceCanvas.height);
  const drawW = sourceCanvas.width * scale;
  const drawH = sourceCanvas.height * scale;
  const dx = (outW - drawW) / 2;
  const dy = (outH - drawH) / 2;

  oCtx.imageSmoothingEnabled = true;
  oCtx.imageSmoothingQuality = "high";
  oCtx.drawImage(sourceCanvas, dx, dy, drawW, drawH);

  return out.toDataURL("image/jpeg", 0.94);
}
