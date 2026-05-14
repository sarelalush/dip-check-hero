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
  opts: { outWidth?: number; outHeight?: number; padding?: number } = {},
): Promise<string> {
  const outW = opts.outWidth ?? 640;
  const outH = opts.outHeight ?? 800;
  const padding = opts.padding ?? 60;

  const img = await loadImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return dataUrl;

  const cropX = Math.max(0, Math.round(rect.x * w));
  const cropY = Math.max(0, Math.round(rect.y * h));
  const cropW = Math.max(1, Math.round(rect.w * w));
  const cropH = Math.max(1, Math.round(rect.h * h));

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);

  const availW = outW - padding * 2;
  const availH = outH - padding * 2;
  const scale = Math.min(availW / cropW, availH / cropH);
  const drawW = cropW * scale;
  const drawH = cropH * scale;
  const dx = (outW - drawW) / 2;
  const dy = (outH - drawH) / 2;

  ctx.drawImage(img, cropX, cropY, cropW, cropH, dx, dy, drawW, drawH);
  return out.toDataURL("image/jpeg", 0.93);
}
