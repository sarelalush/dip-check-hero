import { describe, expect, it } from 'vitest';

import {
  AQUACHEK_PRO_COMBINED_PAD_COLORS,
  AQUACHEK_PRO_REFS,
  analyzeAquachekProPadRgbs,
  getFixedPadSampleRegions,
} from '../supabase/functions/_shared/aquachek-pro-reference.js';
import {
  VALID_VARIANTS,
  buildInvalidFixtures,
  enumerateCanonicalCases,
  renderSyntheticColors,
  renderSyntheticStrip,
  sampleFixturePads,
  sampleFixtureWhiteReference,
} from '../scripts/aquachek-synthetic/fixture-utils.mjs';

describe('AquaChek Pro reference chart', () => {
  it('contains all manufacturer chart levels', () => {
    expect(AQUACHEK_PRO_COMBINED_PAD_COLORS).toHaveLength(6);
    expect(AQUACHEK_PRO_REFS.freeChlorine.map((entry) => entry.value)).toEqual([
      0, 0.5, 1, 3, 5, 10, 20,
    ]);
    expect(AQUACHEK_PRO_REFS.ph.map((entry) => entry.value)).toEqual([6.2, 6.8, 7.2, 7.8, 8.4]);
    expect(AQUACHEK_PRO_REFS.alkalinity.map((entry) => entry.value)).toEqual([
      0, 40, 80, 120, 180, 240,
    ]);
  });

  it('enumerates all 1,260 legal four-pad combinations', () => {
    expect(enumerateCanonicalCases()).toHaveLength(6 * 7 * 5 * 6);
  });

  it('classifies every exact chart combination correctly', () => {
    for (const testCase of enumerateCanonicalCases()) {
      const result = analyzeAquachekProPadRgbs(testCase.padRgbs);
      expect(result.nearestValues).toEqual(testCase.expected);
    }
  });

  it('classifies every controlled synthetic rendering correctly', () => {
    for (const testCase of enumerateCanonicalCases()) {
      for (const variant of VALID_VARIANTS) {
        const colors = renderSyntheticColors(testCase, variant);
        const result = analyzeAquachekProPadRgbs(colors.padRgbs, {
          whiteReference: colors.whiteReference,
        });
        expect(result.nearestValues, `${variant.id}:${testCase.id}`).toEqual(testCase.expected);
      }
    }
  });

  it('preserves classes after rendering and fixed-region sampling', () => {
    const representativeCases = enumerateCanonicalCases().filter((_, index) => index % 251 === 0);
    for (const testCase of representativeCases) {
      for (const variant of VALID_VARIANTS) {
        const { png } = renderSyntheticStrip(testCase, variant);
        const result = analyzeAquachekProPadRgbs(sampleFixturePads(png), {
          whiteReference: sampleFixtureWhiteReference(png),
        });
        expect(result.nearestValues, `${variant.id}:${testCase.id}`).toEqual(testCase.expected);
      }
    }
  });

  it('uses stable fixed sampling geometry', () => {
    const regions = getFixedPadSampleRegions(128, 384, 4);
    expect(regions).toHaveLength(4);
    expect(regions.map((region) => Number((region.y + region.height / 2).toFixed(1)))).toEqual([
      105.6, 163.2, 220.8, 278.4,
    ]);
  });

  it('rejects a non-four-pad input', () => {
    expect(() => analyzeAquachekProPadRgbs([[255, 255, 255]])).toThrow(/exactly 4 physical pads/);
  });

  it('catalogues all required end-to-end rejection scenarios', () => {
    const sourceCase = enumerateCanonicalCases()[0];
    expect(buildInvalidFixtures(sourceCase).map((fixture) => fixture.expectedFailureReason)).toEqual([
      'strip_not_detected',
      'pad_count_mismatch',
      'strip_cropped',
      'strip_too_small',
      'strong_glare',
      'strip_not_straight',
    ]);
  });
});
