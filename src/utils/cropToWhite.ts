// Crop a region from an image and place it on a clean white background,
// centered at a fixed output size. Used by the manual-crop confirm flow.

export interface CropRectNorm {
  /** All values normalized 0..1 relative to original image. */
  x: number;
  y: number;
  w: number;
  h: number;
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

  const cropX = Math.max(0, Math.round(rect.x * w));
  const cropY = Math.max(0, Math.round(rect.y * h));
  const cropW = Math.max(1, Math.round(rect.w * w));
  const cropH = Math.max(1, Math.round(rect.h * h));

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
