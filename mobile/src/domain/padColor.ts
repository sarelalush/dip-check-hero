import type { StripAnalysisResult } from './scanResults';
import type { StripParameter } from './strip';
import { alignPadColorBoxes, type PadColorBox } from '../../../supabase/functions/_shared/pad-color-geometry';

export interface PadPhotoCrop {
  uri: string;
  imageWidth: number;
  imageHeight: number;
  centerX: number;
  centerY: number;
  side: number;
}

export type PadColor =
  | { source: 'reference'; rgb: [number, number, number] }
  | { source: 'photo'; crop: PadPhotoCrop; referenceRgb?: [number, number, number] };

const PRO_PAD_INDEX: Partial<Record<StripParameter, number>> = {
  totalChlorine: 0,
  bromine: 0,
  freeChlorine: 1,
  ph: 2,
  alkalinity: 3,
};

function validRgb(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every(channel =>
    typeof channel === 'number' && Number.isFinite(channel) && channel >= 0 && channel <= 255);
}

function validBox(box: PadColorBox): boolean {
  return box && [box.centerX, box.centerY, box.width, box.height].every(Number.isFinite) &&
    box.centerX > 0 && box.centerX < 1 && box.centerY > 0 && box.centerY < 1 &&
    box.width > 0 && box.width <= 1 && box.height > 0 && box.height <= 1;
}

// Display a crop of the source photo, never an averaged/reconstructed hue.
// Saved geometry can be realigned without rerunning the model or changing data.
export function getPadColor(
  result: StripAnalysisResult,
  key: StripParameter,
  photoSize?: { width: number; height: number; uri?: string },
): PadColor | undefined {
  const padIndex = PRO_PAD_INDEX[key];
  const colorAnalysis = result.evidence?.colorAnalysis;
  const isPro = result.brandId === 'aquachek-pro-5in1' ||
    result.evidence?.referenceRevision?.startsWith('aquachek-pro-reference-');
  const parameter = result.parameters.find(item => item.key === key);
  const evidence = parameter?.evidence ?? result.evidence?.parameters?.[key];
  const referenceRgb = evidence && validRgb(evidence.referenceRgb) &&
    (evidence.selectedValue === undefined || evidence.selectedValue === parameter?.value)
    ? evidence.referenceRgb : undefined;
  const uri = photoSize?.uri || result.imageUri || result.imageUrl;
  const imageWidth = photoSize?.width;
  const imageHeight = photoSize?.height;
  const analysisWidth = colorAnalysis?.imageWidth ?? result.imageQuality?.width;
  const analysisHeight = colorAnalysis?.imageHeight ?? result.imageQuality?.height ?? imageHeight;
  if (isPro && padIndex !== undefined && uri && typeof imageWidth === 'number' &&
    typeof imageHeight === 'number' && Number.isFinite(imageWidth) && Number.isFinite(imageHeight) &&
    imageWidth > 0 && imageHeight > 0 && typeof analysisHeight === 'number' && analysisHeight > 0 &&
    (!analysisWidth || Math.abs((imageWidth / imageHeight) / (analysisWidth / analysisHeight) - 1) < 0.02)) {
    const modelBoxes = colorAnalysis?.modelPadBoxes;
    const boxes = colorAnalysis?.padColorIdentity === 'structure-aligned' &&
      Array.isArray(colorAnalysis.sampledPadBoxes) && colorAnalysis.sampledPadBoxes.length === 4 &&
      colorAnalysis.sampledPadBoxes.every(validBox)
      ? colorAnalysis.sampledPadBoxes
      : Array.isArray(modelBoxes) && modelBoxes.length === 4 && modelBoxes.every(validBox)
        ? alignPadColorBoxes(analysisHeight, modelBoxes, [
          ...(Array.isArray(colorAnalysis?.structure?.colorBands) ? colorAnalysis.structure.colorBands : []),
          ...(Array.isArray(colorAnalysis?.structure?.ignoredColorBands) ? colorAnalysis.structure.ignoredColorBands : []),
        ]) : undefined;
    const box = boxes?.[padIndex];
    if (box && validBox(box)) {
      const side = Math.min(box.width * imageWidth, box.height * imageHeight) * 0.58;
      const centerX = box.centerX * imageWidth;
      const centerY = box.centerY * imageHeight;
      if (side >= 2 && centerX - side / 2 >= 0 && centerY - side / 2 >= 0 &&
        centerX + side / 2 <= imageWidth && centerY + side / 2 <= imageHeight) {
        return { source: 'photo', crop: { uri, imageWidth, imageHeight, centerX, centerY, side }, referenceRgb };
      }
    }
  }
  return referenceRgb ? { rgb: referenceRgb, source: 'reference' } : undefined;
}
