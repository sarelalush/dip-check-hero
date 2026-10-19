import type { ScanParameterStatusKind, ScanResultParameter } from './scanResults';

// A review trigger for photo estimates, not a measured combined-chlorine result
// or an Israeli bathing standard. CDC uses >0.4 ppm as an example requiring
// attention: https://www.cdc.gov/healthy-swimming/toolkit/chloramines-and-pool-operation.html
const CHLORINE_GAP_REVIEW_PPM = 0.4;

export interface ChlorineReview {
  reason: 'inconsistent' | 'gap';
}

export function needsReadingVerification(parameter: Pick<ScanResultParameter, 'evidence'>): boolean {
  return parameter.evidence?.needsVerification === true ||
    parameter.evidence?.modelCertainty === 'adjacent' || parameter.evidence?.modelCertainty === 'unreadable';
}

// Keep the diagnostic evidence, but distinguish it from ambiguity that changes
// the direction of treatment. Two adjacent colours within the same comparison
// band do not make every metric a warning. Unknown legacy evidence stays cautious.
export function readingNeedsClarification(parameter: ScanResultParameter): boolean {
  const evidence = parameter.evidence;
  if (!evidence) return false;
  if (evidence.modelCertainty === 'clear') return false;
  if (evidence.modelCertainty === 'unreadable') return true;
  if (evidence.modelCertainty === 'adjacent') {
    const alternative = evidence.alternativeValue;
    if (typeof alternative !== 'number' || !Number.isFinite(alternative) || alternative < 0) return true;
    const selectedKind = comparisonKind(parameter);
    const alternativeKind = comparisonKind({ ...parameter, value: alternative });
    return selectedKind === undefined || alternativeKind === undefined || selectedKind !== alternativeKind;
  }
  return evidence.needsVerification === true;
}

// Cached status flags are not authoritative: compare the actual reading.
export function comparisonKind(parameter: Pick<ScanResultParameter, 'value' | 'idealRange'>): ScanParameterStatusKind | undefined {
  const range = parameter.idealRange;
  if (!Number.isFinite(parameter.value) || !range || !Number.isFinite(range.min) ||
      !Number.isFinite(range.max) || range.min > range.max) return undefined;
  return parameter.value < range.min ? 'low' : parameter.value > range.max ? 'high' : 'ok';
}

// Compare reported estimates only. Neither a gap nor an impossible ordering
// changes a reading, calculates a dose, or confirms combined chlorine.
export function getChlorineReview(parameters: Pick<ScanResultParameter, 'key' | 'value'>[]): ChlorineReview | undefined {
  const total = parameters.find(parameter => parameter.key === 'totalChlorine')?.value;
  const free = parameters.find(parameter => parameter.key === 'freeChlorine')?.value;
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0 ||
      typeof free !== 'number' || !Number.isFinite(free) || free < 0) return undefined;
  if (total < free) return { reason: 'inconsistent' };
  if (total - free > CHLORINE_GAP_REVIEW_PPM + 1e-6) return { reason: 'gap' };
  return undefined;
}
