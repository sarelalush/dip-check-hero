// Real-time frame quality analyzer for the live strip scanner.
// Runs on a small ROI (the target frame area) to stay cheap.

export type FrameIssue =
  | "ok"
  | "too_dark"
  | "too_bright"
  | "blurry"
  | "no_strip"
  | "shaky"
  | "framing";

export interface FrameQuality {
  brightness: number;
  sharpness: number;
  colorfulness: number;
  motion: number; // 0..1, higher = more movement between frames
  quality: number;
  issue: FrameIssue;
  tipHe: string;
  lumaGrid: Float32Array; // for motion comparison on the next frame
  gridCols: number;
  gridRows: number;
}

const MOTION_THRESHOLD = 0.06; // mean abs luma diff (normalized 0..1) above which we call it "shaky"

/**
 * Analyze a Region Of Interest from a video frame canvas.
 * Pass `prev` to enable inter-frame motion estimation.
 */
export function analyzeFrameQuality(
  ctx: CanvasRenderingContext2D,
  roi: { x: number; y: number; w: number; h: number },
  prev?: { lumaGrid: Float32Array; gridCols: number; gridRows: number } | null,
): FrameQuality {
  const { x, y, w, h } = roi;
  const img = ctx.getImageData(x, y, w, h);
  const data = img.data;

  const stride = Math.max(1, Math.floor(Math.sqrt((w * h) / 4000)));
  const cols = Math.ceil(w / stride);
  const rows = Math.ceil(h / stride);
  const lumaGrid = new Float32Array(cols * rows);

  let lumaSum = 0;
  let chromaSum = 0;
  let count = 0;
  let gi = 0;

  for (let py = 0; py < h; py += stride) {
    for (let px = 0; px < w; px += stride) {
      const i = (py * w + px) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      lumaSum += luma;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      chromaSum += maxC - minC;
      lumaGrid[gi++] = luma;
      count++;
    }
  }

  const brightness = lumaSum / count;
  const colorfulness = chromaSum / count;

  // Sharpness via variance of discrete Laplacian over luma grid
  let lapSum = 0;
  let lapSumSq = 0;
  let lapN = 0;
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

  // Motion: mean absolute luma difference vs previous frame (same grid shape)
  let motion = 0;
  if (
    prev &&
    prev.gridCols === cols &&
    prev.gridRows === rows &&
    prev.lumaGrid.length === lumaGrid.length
  ) {
    let diffSum = 0;
    for (let k = 0; k < lumaGrid.length; k++) {
      diffSum += Math.abs(lumaGrid[k] - prev.lumaGrid[k]);
    }
    // Normalize: divide by 255 to get 0..1
    motion = diffSum / lumaGrid.length / 255;
  }

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
  } else if (motion > MOTION_THRESHOLD) {
    issue = "shaky";
    tipHe = "יש רעד — ייצב את היד או הישען על משטח";
  } else if (sharpness < 80) {
    issue = "blurry";
    tipHe = "מטושטש — ייצב את היד והמתן לפוקוס";
  }

  const brightScore =
    brightness < 55 || brightness > 225
      ? 0.2
      : 1 - Math.abs(brightness - 140) / 140;
  const sharpScore = Math.min(1, sharpness / 250);
  const colorScore = Math.min(1, colorfulness / 60);
  // Motion penalty: 0 motion -> 1, MOTION_THRESHOLD -> ~0.5, 2x threshold -> 0
  const motionScore = Math.max(0, 1 - motion / (MOTION_THRESHOLD * 2));
  const quality = Math.max(
    0,
    Math.min(
      1,
      brightScore * 0.25 + sharpScore * 0.3 + colorScore * 0.2 + motionScore * 0.25,
    ),
  );

  return {
    brightness,
    sharpness,
    colorfulness,
    motion,
    quality,
    issue,
    tipHe,
    lumaGrid,
    gridCols: cols,
    gridRows: rows,
  };
}
