// Gray-world white balance: normalizes color cast (e.g., yellow indoor light)
// before sending the strip image to the AI. Improves consistency across shots.

export async function whiteBalanceDataUrl(dataUrl: string, maxSize = 1280): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Sample only "highlight-ish" pixels (luma > 180) which approximate white refs.
  // Fall back to full average if not enough highlights are found.
  let rH = 0, gH = 0, bH = 0, nH = 0;
  let rA = 0, gA = 0, bA = 0, nA = 0;
  const stride = 4;
  for (let i = 0; i < data.length; i += 4 * stride) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    rA += r; gA += g; bA += b; nA++;
    if (luma > 180 && luma < 250) {
      rH += r; gH += g; bH += b; nH++;
    }
  }

  const usingHighlights = nH > nA * 0.02;
  const meanR = (usingHighlights ? rH / nH : rA / nA) || 1;
  const meanG = (usingHighlights ? gH / nH : gA / nA) || 1;
  const meanB = (usingHighlights ? bH / nH : bA / nA) || 1;

  // Scale each channel toward the average gray so the cast is removed.
  const gray = (meanR + meanG + meanB) / 3;
  const sR = gray / meanR;
  const sG = gray / meanG;
  const sB = gray / meanB;

  // Skip if cast is negligible (within 3%).
  const maxDev = Math.max(Math.abs(sR - 1), Math.abs(sG - 1), Math.abs(sB - 1));
  if (maxDev < 0.03) return canvas.toDataURL("image/jpeg", 0.92);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp255(data[i] * sR);
    data[i + 1] = clamp255(data[i + 1] * sG);
    data[i + 2] = clamp255(data[i + 2] * sB);
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function clamp255(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
