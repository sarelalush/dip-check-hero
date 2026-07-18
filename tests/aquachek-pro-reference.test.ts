import { describe, expect, it } from 'vitest';

import {
  AQUACHEK_PRO_COMBINED_PAD_COLORS,
  AQUACHEK_PRO_REFS,
  analyzeAquachekProDiscretePadRgbs,
  analyzeAquachekProPadRgbs,
  analyzeAquachekProStructure,
  getFixedPadSampleRegions,
  hasMinimumAquachekStructureConfidence,
  measureAquachekProSharpness,
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

  it('returns only manufacturer levels for production readings', () => {
    const averageRgb = (first: number[], second: number[]) =>
      first.map((channel, index) => (channel + second[index]) / 2) as [number, number, number];
    const pads = [
      averageRgb(AQUACHEK_PRO_REFS.totalChlorine[0].rgb, AQUACHEK_PRO_REFS.totalChlorine[1].rgb),
      averageRgb(AQUACHEK_PRO_REFS.freeChlorine[2].rgb, AQUACHEK_PRO_REFS.freeChlorine[3].rgb),
      averageRgb(AQUACHEK_PRO_REFS.ph[1].rgb, AQUACHEK_PRO_REFS.ph[2].rgb),
      averageRgb(AQUACHEK_PRO_REFS.alkalinity[3].rgb, AQUACHEK_PRO_REFS.alkalinity[4].rgb),
    ];
    const result = analyzeAquachekProDiscretePadRgbs(pads);

    expect(result.values).toEqual(result.nearestValues);
    expect(AQUACHEK_PRO_REFS.totalChlorine.map((entry) => entry.value)).toContain(result.values.totalChlorine);
    expect(AQUACHEK_PRO_REFS.freeChlorine.map((entry) => entry.value)).toContain(result.values.freeChlorine);
    expect(AQUACHEK_PRO_REFS.ph.map((entry) => entry.value)).toContain(result.values.ph);
    expect(AQUACHEK_PRO_REFS.alkalinity.map((entry) => entry.value)).toContain(result.values.alkalinity);
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

  it('separates sharply rendered strips from heavily blurred strips', () => {
    const { png } = renderSyntheticStrip(enumerateCanonicalCases()[417], VALID_VARIANTS[0]);
    const blurred = new Uint8Array(png.data.length);
    const blurRadius = 12;
    for (let y = 0; y < png.height; y += 1) {
      for (let x = 0; x < png.width; x += 1) {
        const totals = [0, 0, 0];
        let count = 0;
        for (let dy = -blurRadius; dy <= blurRadius; dy += 1) {
          for (let dx = -blurRadius; dx <= blurRadius; dx += 1) {
            const sampleX = Math.max(0, Math.min(png.width - 1, x + dx));
            const sampleY = Math.max(0, Math.min(png.height - 1, y + dy));
            const sampleOffset = (sampleY * png.width + sampleX) * 4;
            for (let channel = 0; channel < 3; channel += 1) {
              totals[channel] += png.data[sampleOffset + channel];
            }
            count += 1;
          }
        }
        const targetOffset = (y * png.width + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          blurred[targetOffset + channel] = Math.round(totals[channel] / count);
        }
        blurred[targetOffset + 3] = 255;
      }
    }
    const sharp = measureAquachekProSharpness(png.width, png.height, (x, y) => {
      const offset = (y * png.width + x) * 4;
      return [png.data[offset], png.data[offset + 1], png.data[offset + 2]];
    });
    const outOfFocus = measureAquachekProSharpness(png.width, png.height, (x, y) => {
      const offset = (y * png.width + x) * 4;
      return [blurred[offset], blurred[offset + 1], blurred[offset + 2]];
    });

    expect(sharp.sampleCount).toBeGreaterThan(1_000);
    expect(sharp.variance).toBeGreaterThan(1_000);
    expect(outOfFocus.variance).toBeLessThan(8);
  });

  it('accepts a valid centered four-pad carrier structure', () => {
    const { png } = renderSyntheticStrip(enumerateCanonicalCases()[417], VALID_VARIANTS[0]);
    const structure = analyzeAquachekProStructure(png.width, png.height, (x, y) => {
      const offset = (y * png.width + x) * 4;
      return [png.data[offset], png.data[offset + 1], png.data[offset + 2]];
    });

    expect(structure.passed).toBe(true);
    expect(structure.hasNeutralCarrier).toBe(true);
    expect(structure.hasOversizedBand).toBe(false);
    expect(structure.hasSplitOrExtraBands).toBe(false);
  });

  it('uses exposed neutral carrier when a reagent pad fills the old reference window', () => {
    const { png } = renderSyntheticStrip(enumerateCanonicalCases()[417], VALID_VARIANTS[0]);
    const startY = Math.floor(png.height * 0.09);
    const endY = Math.ceil(png.height * 0.15);
    for (let y = startY; y < endY; y += 1) {
      for (let x = Math.floor(png.width * 0.43); x < Math.ceil(png.width * 0.57); x += 1) {
        const offset = (y * png.width + x) * 4;
        [png.data[offset], png.data[offset + 1], png.data[offset + 2]] = [228, 71, 135];
      }
    }
    const structure = analyzeAquachekProStructure(png.width, png.height, (x, y) => {
      const offset = (y * png.width + x) * 4;
      return [png.data[offset], png.data[offset + 1], png.data[offset + 2]];
    });

    expect(structure.passed).toBe(true);
    expect(structure.carrierChroma).toBeLessThanOrEqual(20);
    expect(structure.hasOversizedBand).toBe(false);
  });

  it('rejects an extra pad merged between two legal pads', () => {
    const { png } = renderSyntheticStrip(enumerateCanonicalCases()[417], VALID_VARIANTS[0]);
    const regions = getFixedPadSampleRegions(png.width, png.height, 4);
    const first = regions[0];
    const second = regions[1];
    const startY = Math.round((first.y + first.height + second.y) / 2) - 8;
    for (let y = startY; y < startY + 16; y += 1) {
      for (let x = 32; x < 64; x += 1) {
        const offset = (y * png.width + x) * 4;
        [png.data[offset], png.data[offset + 1], png.data[offset + 2]] = [114, 84, 169];
      }
    }
    const structure = analyzeAquachekProStructure(png.width, png.height, (x, y) => {
      const offset = (y * png.width + x) * 4;
      return [png.data[offset], png.data[offset + 1], png.data[offset + 2]];
    });

    expect(structure.passed).toBe(false);
    expect(structure.hasOversizedBand).toBe(true);
  });

  it('rejects four colored decoys without a neutral strip carrier', () => {
    const width = 96;
    const height = 288;
    const background: [number, number, number] = [22, 139, 178];
    const structure = analyzeAquachekProStructure(width, height, () => background);

    expect(structure.passed).toBe(false);
    expect(structure.hasNeutralCarrier).toBe(false);
  });

  it('rejects unanimous weak model structure guesses', () => {
    expect(hasMinimumAquachekStructureConfidence([0.3, 0.3, 0.3], 0.5)).toBe(false);
  });

  it('accepts when at least one structure pass reaches the minimum confidence', () => {
    expect(hasMinimumAquachekStructureConfidence([0.3, 0.5, 0.3], 0.5)).toBe(true);
  });

  it('rejects missing and non-numeric structure confidence', () => {
    expect(hasMinimumAquachekStructureConfidence([], 0.5)).toBe(false);
    expect(hasMinimumAquachekStructureConfidence([Number.NaN, undefined, null], 0.5)).toBe(false);
  });
});
