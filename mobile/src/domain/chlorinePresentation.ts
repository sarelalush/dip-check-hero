import { comparisonKind } from './readingComparison';
import type { ScanResultParameter } from './scanResults';

// Display policy only. The stored/model-selected reading and its ambiguity stay
// intact for dosing guards, chlorine-pair review and historical audit.
export function totalChlorinePresentation(parameter?: ScanResultParameter) {
  if (!parameter || parameter.key !== 'totalChlorine' ||
      !Number.isFinite(parameter.value) || parameter.value < 0) return undefined;
  const alternative = parameter.evidence?.modelCertainty === 'adjacent'
    ? parameter.evidence.alternativeValue : undefined;
  const usesUpperCandidate = typeof alternative === 'number' && Number.isFinite(alternative) &&
    alternative >= 0 && alternative !== parameter.value;
  const value = usesUpperCandidate ? Math.max(parameter.value, alternative!) : parameter.value;
  return { value, usesUpperCandidate,
    lowerCandidate: usesUpperCandidate ? Math.min(parameter.value, alternative!) : undefined,
    kind: comparisonKind({ ...parameter, value }),
  };
}
