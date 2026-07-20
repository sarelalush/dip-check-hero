// Crop a region from an image and place it on a clean white background,
// centered at a fixed output size. Used by the manual-crop confirm flow.

export interface CropRectNorm {
  /** All values normalized 0..1 relative to original image. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CropSafetyMarginOptions {
  horizontalRatio?: number;
  verticalRatio?: number;
  minHorizontal?: number;
  minVertical?: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * Preserve a small amount of the original scene around a manual crop.
 * The strip detector needs visible carrier edges and a little contrasting
 * background; an exact edge-to-edge crop can remove both signals.
 */
export function addCropSafetyMargin(
  rect: CropRectNorm,
  options: CropSafetyMarginOptions = {},
): CropRectNorm {
  const x = clamp(rect.x, 0, 1);
  const y = clamp(rect.y, 0, 1);
  const w = clamp(rect.w, 0.0001, 1 - x);
  const h = clamp(rect.h, 0.0001, 1 - y);
  const horizontalPadding = Math.max(
    w * (options.horizontalRatio ?? 0.15),
    options.minHorizontal ?? 0.006,
  );
  const verticalPadding = Math.max(
    h * (options.verticalRatio ?? 0.03),
    options.minVertical ?? 0.004,
  );

  const expandedW = Math.min(1, w + horizontalPadding * 2);
  const expandedH = Math.min(1, h + verticalPadding * 2);
  const centerX = x + w / 2;
  const centerY = y + h / 2;

  return {
    x: clamp(centerX - expandedW / 2, 0, 1 - expandedW),
    y: clamp(centerY - expandedH / 2, 0, 1 - expandedH),
    w: expandedW,
    h: expandedH,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export async function cropToWhite(
  dataUrl: string,
  rect: CropRectNorm,
  opts: { maxDimension?: number; paddingRatio?: number } = {},
): Promise<string> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return dataUrl;

  const safeRect = addCropSafetyMargin(rect);
  const cropX = Math.max(0, Math.round(safeRect.x * w));
  const cropY = Math.max(0, Math.round(safeRect.y * h));
  const cropW = Math.max(1, Math.min(w - cropX, Math.round(safeRect.w * w)));
  const cropH = Math.max(1, Math.min(h - cropY, Math.round(safeRect.h * h)));

  // Preserve the user's crop aspect ratio instead of placing a narrow strip
  // inside a fixed canvas with large white margins. Keep only a tiny safety
  // border so the strip edges are not accidentally clipped.
  const maxDimension = opts.maxDimension ?? 1_600;
  const paddingRatio = opts.paddingRatio ?? 0.015;
  const naturalLongSide = Math.max(cropW, cropH);
  const scale = Math.min(1, maxDimension / naturalLongSide);
  const contentW = Math.max(1, Math.round(cropW * scale));
  const contentH = Math.max(1, Math.round(cropH * scale));
  const padding = Math.max(1, Math.round(Math.min(contentW, contentH) * paddingRatio));
  const outW = contentW + padding * 2;
  const outH = contentH + padding * 2;

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);

  ctx.drawImage(img, cropX, cropY, cropW, cropH, padding, padding, contentW, contentH);
  return out.toDataURL("image/jpeg", 0.95);
}
