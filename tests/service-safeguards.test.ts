import { describe, expect, it } from 'vitest';
import { calculateDosage, MEASUREMENT_ACTION, protectAnalysisResult } from '../mobile/src/domain/dosage';
import { formatReading, nextAction, resultStatus } from '../mobile/src/domain/resultPresentation';
import type { StripAnalysisResult, ScanResultParameter } from '../mobile/src/domain/scanResults';
import type { Pool } from '../mobile/src/domain/pool';

function parameter(key: ScanResultParameter['key'], value: number, min: number, max: number): ScanResultParameter {
  return { key, name: key, value, unit: key === 'ph' ? '' : 'ppm',
    idealRange: { min, max, label: 'comparison' },
    status: { kind: value < min ? 'low' : value > max ? 'high' : 'ok', label: 'legacy', tone: 'success' },
    recommendation: 'הוסף 750 מ״ל חומר ואפשר לרחוץ אחרי שעה', progress: 50 };
}
function result(): StripAnalysisResult {
  return { id: 'local-fixture', analyzedAt: 1, accepted: true, isValidStrip: true,
    overallStatus: { label: 'legacy', tone: 'success' },
    recommendation: 'הוסף 750 מ״ל חומר',
    parameters: [parameter('ph', 7.4, 7.2, 7.6), parameter('freeChlorine', 2, 1, 3), parameter('alkalinity', 100, 80, 120)] };
}

describe('measurement-only treatment policy', () => {
  it.each([0, 7.4, 14])('never emits a dose or actionable treatment for pH %s', (ph) => {
    const reading = result(); reading.parameters[0].value = ph;
    const pool = { volumeLiters: 30000, tabletsActive: true, tabletsCount: 4 } as Pool;
    const plan = calculateDosage(reading, pool);
    expect(plan.treatmentBlocked).toBe(true);
    expect(plan.primaryRecommendation).toBeUndefined();
    expect(plan.summary).toBe(MEASUREMENT_ACTION);
    for (const card of plan.recommendations) {
      expect(card.product).toBeUndefined();
      expect(card.active).toBe(false);
      expect(card.blocked).toBe(true);
      expect(card.exactAmountAvailable).toBe(false);
    }
  });
  it('replaces old cached doses and advice without changing the measurements or input', () => {
    const reading = result();
    const oldCard = { ...calculateDosage(reading).recommendations[0], active: true, blocked: false,
      exactAmountAvailable: true, product: { key: 'acidHCl' as const, amount: 750, unit: 'ml', labelHe: 'old' } };
    reading.dosage = { ...calculateDosage(reading), primaryRecommendation: oldCard,
      recommendations: [oldCard], treatmentBlocked: false, summary: 'הוסף חומר' };
    const before = structuredClone(reading);
    const protectedReading = protectAnalysisResult(reading);
    expect(reading).toEqual(before);
    expect(protectedReading.parameters.map(p => p.value)).toEqual([7.4, 2, 100]);
    expect(protectedReading.recommendation).toBe(MEASUREMENT_ACTION);
    expect(nextAction(protectedReading)).toBe(MEASUREMENT_ACTION);
    expect(protectedReading.dosage?.primaryRecommendation).toBeUndefined();
    expect(protectedReading.dosage?.recommendations.every(card => card.blocked && !card.active && !card.product)).toBe(true);
    expect(protectedReading.parameters.every(p => !p.recommendation.includes('750'))).toBe(true);
  });
  it.each([undefined, 0, -1, NaN, Infinity])('handles missing/invalid volume %s without producing treatment', (volume) => {
    const plan = calculateDosage(result(), volume === undefined ? undefined : { volumeLiters: volume } as Pool);
    expect(plan.volumeMissing).toBe(true);
    expect(plan.treatmentBlocked).toBe(true);
  });
});

describe('result status and next action', () => {
  it.each([
    { accepted: false }, { isValidStrip: false }, { lowConfidence: true }, { failureReason: 'lighting' as const },
  ])('requests a new photo for rejected readings: %j', (flags) => {
    const reading = { ...result(), ...flags };
    expect(resultStatus(reading).label).toBe('נדרש צילום חוזר');
    expect(resultStatus(reading).tone).toBe('warning');
    expect(nextAction(reading)).not.toContain('750');
  });
  it.each([NaN, Infinity, -Infinity])('does not show a successful status for non-finite value %s', (value) => {
    const reading = result(); reading.parameters[0].value = value;
    expect(resultStatus(reading).tone).toBe('neutral');
    expect(formatReading(reading.parameters[0])).toBe('—');
    expect(calculateDosage(reading).recommendations).toHaveLength(2);
  });
  it('does not label partial or empty readings successful', () => {
    const reading = result(); reading.parameters.pop();
    expect(resultStatus(reading).tone).toBe('neutral');
    reading.parameters = [];
    expect(resultStatus(reading).tone).toBe('neutral');
  });
  it('does not trust an old green flag when the numeric reading is outside its range', () => {
    const reading = result(); reading.parameters[0].value = 9;
    expect(resultStatus(reading).tone).toBe('warning');
    expect(protectAnalysisResult(reading).parameters[0].status.kind).toBe('high');
  });
  it.each([{min:NaN,max:8}, {min:8,max:7}, {min:7,max:Infinity}])('does not show success for an invalid comparison range %j', (range) => {
    const reading = result(); Object.assign(reading.parameters[0].idealRange, range);
    expect(resultStatus(reading).tone).toBe('neutral');
  });
  it('uses comparison wording instead of a swimming approval', () => {
    expect(resultStatus(result()).label).toBe('הערכים בטווח ההשוואה');
    expect(nextAction(result())).toBe(MEASUREMENT_ACTION);
  });
});
