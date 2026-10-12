import type { ScanParameterStatusKind, ScanResultParameter } from './scanResults';

// Cached status flags are not authoritative: compare the actual reading.
export function comparisonKind(parameter: ScanResultParameter): ScanParameterStatusKind | undefined {
  const range = parameter.idealRange;
  if (!Number.isFinite(parameter.value) || !range || !Number.isFinite(range.min) ||
      !Number.isFinite(range.max) || range.min > range.max) return undefined;
  return parameter.value < range.min ? 'low' : parameter.value > range.max ? 'high' : 'ok';
}
