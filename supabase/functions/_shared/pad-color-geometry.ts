export interface PadColorBox {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export interface PadColorBand {
  startY: number;
  endY: number;
  height: number;
}

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

// Resolve a common coordinate offset only from one unambiguous four-band
// sequence. The same geometry is used by the server and saved-photo previews.
// No color/chemical value participates in choosing the physical regions.
export function alignPadColorBoxes(
  imageHeight: number,
  modelBoxes: PadColorBox[],
  bands: PadColorBand[],
): PadColorBox[] | undefined {
  if (!Array.isArray(modelBoxes) || modelBoxes.length !== 4 ||
    modelBoxes.some(box => !box || ![box.centerX, box.centerY, box.width, box.height].every(Number.isFinite) ||
      box.centerX <= 0 || box.centerX >= 1 || box.centerY <= 0 || box.centerY >= 1 ||
      box.width <= 0 || box.width > 1 || box.height <= 0 || box.height > 1) ||
    !Number.isFinite(imageHeight) || imageHeight <= 0 || !Array.isArray(bands) ||
    bands.length < 4 || bands.length > 12 || bands.some(band =>
      !band || !Number.isFinite(band.startY) || !Number.isFinite(band.endY) ||
      band.startY < 0 || band.endY >= imageHeight || band.startY > band.endY)) return;
  const orderedBands = [...bands].sort((left, right) => left.startY - right.startY);
  const orderedBoxes = [...modelBoxes].sort((left, right) => left.centerY - right.centerY);
  const modelGaps = orderedBoxes.slice(1).map((box, index) =>
    (box.centerY - orderedBoxes[index].centerY) * imageHeight);
  const modelStep = median(modelGaps);
  if (!Number.isFinite(modelStep) || modelStep <= 0) return;
  const candidates: PadColorBox[][] = [];
  for (let start = 0; start <= orderedBands.length - 4; start += 1) {
    const sequence = orderedBands.slice(start, start + 4);
    const centers = sequence.map(band => (band.startY + band.endY) / 2);
    const gaps = centers.slice(1).map((center, index) => center - centers[index]);
    const step = median(gaps);
    if (step < modelStep * 0.55 || step > modelStep * 1.8 ||
      gaps.some(gap => gap < step * 0.6 || gap > step * 1.5) ||
      sequence.some(band => !Number.isFinite(band.height) || band.height < 3 ||
        band.height < step * 0.18 || band.height > step * 0.85) ||
      sequence.some((band, index) => index > 0 && band.startY <= sequence[index - 1].endY)) continue;
    const offsets = centers.map((center, index) => center - orderedBoxes[index].centerY * imageHeight);
    const offset = median(offsets);
    if (Math.abs(offset) > step * 1.5 || offsets.some(value => Math.abs(value - offset) > step * 0.4)) continue;
    candidates.push(sequence.map((band, index) => ({
      ...orderedBoxes[index],
      centerY: centers[index] / imageHeight,
      height: band.height / imageHeight,
    })));
  }
  if (candidates.length !== 1) return;
  return modelBoxes[0].centerY <= modelBoxes[3].centerY ? candidates[0] : candidates[0].reverse();
}
