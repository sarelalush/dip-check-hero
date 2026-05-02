// Real-time frame quality analyzer for the live strip scanner.
// Runs on a small ROI (the target frame area) to stay cheap.
//
// Returns:
//  - brightness: 0-255 average luma
//  - sharpness:  variance of Laplacian (higher = sharper)
//  - colorfulness: rough chroma estimate (higher = more colored pads visible)
//  - quality: aggregated 0-1 score
//  - issue: dominant problem (or "ok")
//  - tipHe: short Hebrew instruction for the user

export type FrameIssue =
  | "ok"
  | "too_dark"
  | "too_bright"
  | "blurry"
  | "no_strip"
  | "framing";

export interface FrameQuality {
  brightness: number;
  sharpness: number;
  colorfulness: number;
  quality: number;
  issue: FrameIssue;
  tipHe: string;
}

/**
 * Analyze a Region Of Interest from a video frame canvas.
 * Pass the canvas context and the ROI rect (in canvas pixel coords).
 */
export function analyzeFrameQuality(
  ctx: CanvasRenderingContext2D,
  roi: { x: number; y: number; w: number; h: number },
): FrameQuality {
  const { x, y, w, h } = roi;
  const img = ctx.getImageData(x, y, w, h);
  const data = img.data;

  // Downsample stride to keep things fast on mobile.
  const stride = Math.max(1, Math.floor(Math.sqrt((w * h) / 4000)));

  let lumaSum = 0;
  let chromaSum = 0;
  let count = 0;
  const lumaGrid: number[] = [];
  const cols = Math.ceil(w / stride);

  for (let py = 0; py < h; py += stride) {
    for (let px = 0; px < w; px += stride) {
      const i = (py * w + px) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      lumaSum += luma;
      // Rough chroma: max-min of channels
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      chromaSum += maxC - minC;
      count++;
      lumaGrid.push(luma);
    }
  }

  const brightness = lumaSum / count;
  const colorfulness = chromaSum / count;

  // Variance of a discrete Laplacian over the luma grid → sharpness proxy.
  let lapSum = 0;
  let lapSumSq = 0;
  let lapN = 0;
  const rows = Math.floor(lumaGrid.length / cols);
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const idx = r * cols + c;
      const lap =
        4 * lumaGrid[idx] -
        lumaGrid[idx - 1] -
        lumaGrid[idx + 1] -
        lumaGrid[idx - cols] -
        lumaGrid[idx + cols];
      lapSum += lap;
      lapSumSq += lap * lap;
      lapN++;
    }
  }
  const lapMean = lapN > 0 ? lapSum / lapN : 0;
  const sharpness = lapN > 0 ? Math.max(0, lapSumSq / lapN - lapMean * lapMean) : 0;

  // Decide issue (priority order)
  let issue: FrameIssue = "ok";
  let tipHe = "מצוין — החזק יציב";
  if (brightness < 55) {
    issue = "too_dark";
    tipHe = "חשוך מדי — עבור למקום מואר יותר";
  } else if (brightness > 225) {
    issue = "too_bright";
    tipHe = "בוהק חזק — הזז כדי להימנע מהשתקפות";
  } else if (colorfulness < 18) {
    issue = "no_strip";
    tipHe = "לא רואים סטיק במסגרת — מקם אותו במרכז";
  } else if (sharpness < 80) {
    issue = "blurry";
    tipHe = "מטושטש — ייצב את היד והמתן לפוקוס";
  }

  // Aggregate 0-1 quality
  const brightScore =
    brightness < 55 || brightness > 225
      ? 0.2
      : 1 - Math.abs(brightness - 140) / 140;
  const sharpScore = Math.min(1, sharpness / 250);
  const colorScore = Math.min(1, colorfulness / 60);
  const quality = Math.max(
    0,
    Math.min(1, brightScore * 0.35 + sharpScore * 0.4 + colorScore * 0.25),
  );

  return { brightness, sharpness, colorfulness, quality, issue, tipHe };
}
