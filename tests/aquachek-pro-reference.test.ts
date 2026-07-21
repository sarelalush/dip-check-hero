import { describe, expect, it } from 'vitest';

import {
  AQUACHEK_PRO_COMBINED_PAD_COLORS,
  AQUACHEK_PRO_REFS,
  analyzeAquachekProDiscretePadRgbs,
  analyzeAquachekProPadRgbs,
  analyzeAquachekProStructure,
  getPadBoxSampleRegions,
  getFixedPadSampleRegions,
  getLocalizedPadSampleRegions,
  locateAquachekProStripCenterX,
  evaluateAquachekReadability,
  hasMinimumAquachekStructureConfidence,
  hasUsableAquachekPadEvidence,
  measureAquachekProSharpness,
  refineAquachekProPadCenterYs,
  robustRgbFromSamples,
  selectAquachekProExpectedColorBands,
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

  it('keeps pad colors stable when glare and shadow contaminate the sample', () => {
    const makeSamples = (
      color: [number, number, number],
      count: number,
    ) => Array.from({ length: count }, (_, index) =>
      color.map((channel, channelIndex) => channel + ((index + channelIndex) % 5) - 2) as [number, number, number]);
    const glare = Array.from({ length: 18 }, () => [252, 252, 250] as [number, number, number]);
    const shadow = Array.from({ length: 10 }, () => [45, 48, 47] as [number, number, number]);

    const ph = robustRgbFromSamples([
      ...makeSamples(AQUACHEK_PRO_REFS.ph[3].rgb, 60),
      ...glare,
      ...shadow,
    ], { preferChroma: true });
    const alkalinity = robustRgbFromSamples([
      ...makeSamples(AQUACHEK_PRO_REFS.alkalinity[5].rgb, 60),
      ...glare,
      ...shadow,
    ], { preferChroma: true });
    const result = analyzeAquachekProDiscretePadRgbs([
      AQUACHEK_PRO_REFS.totalChlorine[1].rgb,
      AQUACHEK_PRO_REFS.freeChlorine[0].rgb,
      ph,
      alkalinity,
    ]);

    expect(result.values.ph).toBe(7.8);
    expect(result.values.alkalinity).toBe(240);
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

  it('samples localized real-strip pads instead of assuming fixed vertical spacing', () => {
    const regions = getLocalizedPadSampleRegions(140, 700, [0.09, 0.2, 0.34, 0.48]);
    expect(regions).toHaveLength(4);
    expect(regions.map((region) => Number(((region.y + region.height / 2) / 700).toFixed(2)))).toEqual([
      0.09, 0.2, 0.34, 0.48,
    ]);
    expect(regions.every((region) => region.width >= 12 && region.height >= 10)).toBe(true);
  });

  it('samples pads around a detected off-center strip', () => {
    const regions = getLocalizedPadSampleRegions(
      200,
      700,
      [0.09, 0.2, 0.34, 0.48],
      0.68,
    );
    expect(regions.every((region) => Math.abs(region.x + region.width / 2 - 136) < 0.01)).toBe(true);
  });

  it('samples every model-localized pad inside its own bounding box', () => {
    const boxes = [
      { centerX: 0.42, centerY: 0.12, width: 0.12, height: 0.07 },
      { centerX: 0.44, centerY: 0.26, width: 0.11, height: 0.075 },
      { centerX: 0.47, centerY: 0.4, width: 0.1, height: 0.08 },
      { centerX: 0.5, centerY: 0.54, width: 0.09, height: 0.085 },
    ];
    const regions = getPadBoxSampleRegions(300, 800, boxes);

    expect(regions).toHaveLength(4);
    regions.forEach((region, index) => {
      expect((region.x + region.width / 2) / 300).toBeCloseTo(boxes[index].centerX, 5);
      expect((region.y + region.height / 2) / 800).toBeCloseTo(boxes[index].centerY, 5);
      expect(region.width).toBeCloseTo(boxes[index].width * 300 * 0.58, 5);
      expect(region.height).toBeCloseTo(boxes[index].height * 800 * 0.58, 5);
    });
  });

  it('keeps tilted pads on independent horizontal lanes', () => {
    const regions = getPadBoxSampleRegions(400, 600, [
      { centerX: 0.38, centerY: 0.18, width: 0.08, height: 0.07 },
      { centerX: 0.42, centerY: 0.32, width: 0.08, height: 0.07 },
      { centerX: 0.46, centerY: 0.46, width: 0.08, height: 0.07 },
      { centerX: 0.5, centerY: 0.6, width: 0.08, height: 0.07 },
    ]);

    expect(regions.map((region) => region.x + region.width / 2)).toEqual([152, 168, 184, 200]);
  });

  it('keeps the physical pad sample width stable across different crop margins', () => {
    const centerYs = [0.09, 0.2, 0.34, 0.48];
    const tightCrop = getLocalizedPadSampleRegions(120, 700, centerYs, 0.5, 36 / 120);
    const wideCrop = getLocalizedPadSampleRegions(420, 700, centerYs, 0.5, 36 / 420);

    expect(tightCrop.map((region) => region.width)).toEqual(wideCrop.map((region) => region.width));
    expect(tightCrop[0].width).toBeCloseTo(22.32, 2);
  });

  it('measures focus inside the detected strip instead of the surrounding crop', () => {
    const centerYs = [0.15, 0.29, 0.43, 0.57];
    const getRgb = (): [number, number, number] => [220, 220, 220];
    const tightCrop = measureAquachekProSharpness(120, 700, getRgb, 60, 36, centerYs);
    const wideCrop = measureAquachekProSharpness(420, 700, getRgb, 210, 36, centerYs);

    expect(tightCrop.region.width).toBe(wideCrop.region.width);
    expect(tightCrop.region.height).toBe(wideCrop.region.height);
  });

  it('locates an off-center carrier from the neutral gaps between pads', () => {
    const width = 200;
    const height = 700;
    const centerYs = [0.15, 0.29, 0.43, 0.57];
    const getRgb = (x: number, y: number): [number, number, number] => {
      const insideCarrier = x >= 126 && x <= 166;
      const insidePad = centerYs.some((center) => Math.abs(y / height - center) < 0.035);
      if (insideCarrier && insidePad) return [210, 75, 145];
      if (insideCarrier) return [248, 248, 244];
      return [152, 132, 106];
    };
    const location = locateAquachekProStripCenterX(width, height, getRgb, centerYs);

    expect(location.centerX).toBeGreaterThan(140);
    expect(location.centerX).toBeLessThan(152);
    expect(location.confidence).toBeGreaterThan(0.5);
  });

  it('reconstructs a pale missing first pad from the visible lower bands', () => {
    const centers = refineAquachekProPadCenterYs(
      760,
      [
        { startY: 190, endY: 216, height: 27 },
        { startY: 261, endY: 325, height: 65 },
        { startY: 376, endY: 440, height: 65 },
      ],
      [0.14, 0.29, 0.44, 0.59],
    );

    expect(centers).toHaveLength(4);
    expect(centers?.[0]).toBeGreaterThan(0.05);
    expect(centers?.[0]).toBeLessThan(0.13);
    expect(centers?.[2]).toBeCloseTo(0.39, 1);
    expect(centers?.[3]).toBeCloseTo(0.54, 1);
  });

  it('keeps model centers when fewer than two reagent bands are visible', () => {
    const modelCenters = [0.1, 0.24, 0.38, 0.52];
    expect(
      refineAquachekProPadCenterYs(
        700,
        [{ startY: 250, endY: 300, height: 51 }],
        modelCenters,
      ),
    ).toEqual(modelCenters);
  });

  it('ignores a distant finger-like band below the grounded four-pad sequence', () => {
    const bands = [
      { startY: 143, endY: 206, height: 64 },
      { startY: 292, endY: 314, height: 23 },
      { startY: 358, endY: 445, height: 88 },
      { startY: 474, endY: 537, height: 64 },
      { startY: 759, endY: 812, height: 54 },
    ];
    const selected = selectAquachekProExpectedColorBands(
      955,
      bands,
      [0.158, 0.282, 0.416, 0.57],
    );

    expect(selected.colorBands).toEqual(bands.slice(0, 4));
    expect(selected.ignoredColorBands).toEqual([bands[4]]);
    expect(selected.expectedBandEnvelope).not.toBeNull();
  });

  it('does not hide an extra band inside the expected reagent area', () => {
    const bands = [
      { startY: 120, endY: 170, height: 51 },
      { startY: 230, endY: 280, height: 51 },
      { startY: 300, endY: 325, height: 26 },
      { startY: 340, endY: 390, height: 51 },
      { startY: 450, endY: 500, height: 51 },
    ];
    const selected = selectAquachekProExpectedColorBands(
      760,
      bands,
      [0.19, 0.33, 0.47, 0.61],
    );

    expect(selected.colorBands).toHaveLength(5);
    expect(selected.ignoredColorBands).toHaveLength(0);
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

  it('lets an intact real four-pad strip reach deterministic validation', () => {
    expect(hasUsableAquachekPadEvidence({
      physicalPadCount: 4,
      visiblePadCenterYs: [0.15, 0.36, 0.57, 0.78],
      padIntegrity: [true, true, true, true],
      allPadsIntact: true,
      hasExactlyOneStrip: true,
      padOrderMatchesSelectedBrand: true,
      hasExtraPadLikeRegions: false,
      stripBodyEvidence: 'ambiguous',
      allPadsFullyVisible: false,
      hasSingleContinuousStripBody: false,
    }, 4)).toBe(true);
  });

  it('keeps missing, extra, damaged, and bodyless pad layouts out', () => {
    const validEvidence = {
      physicalPadCount: 4,
      visiblePadCenterYs: [0.15, 0.36, 0.57, 0.78],
      padIntegrity: [true, true, true, true],
      allPadsIntact: true,
      hasExactlyOneStrip: true,
      padOrderMatchesSelectedBrand: true,
      hasExtraPadLikeRegions: false,
      stripBodyEvidence: 'clear_shared_body',
    };

    expect(hasUsableAquachekPadEvidence({
      ...validEvidence,
      physicalPadCount: 3,
      visiblePadCenterYs: [0.2, 0.5, 0.8],
      padIntegrity: [true, true, true],
    }, 4)).toBe(false);
    expect(hasUsableAquachekPadEvidence({ ...validEvidence, hasExtraPadLikeRegions: true }, 4)).toBe(false);
    expect(hasUsableAquachekPadEvidence({ ...validEvidence, padIntegrity: [true, false, true, true] }, 4)).toBe(false);
    expect(hasUsableAquachekPadEvidence({ ...validEvidence, stripBodyEvidence: 'none' }, 4)).toBe(false);
  });

  it('accepts a readable real-photo crop despite ambiguous band segmentation', () => {
    expect(evaluateAquachekReadability({
      hasUsablePadCenters: true,
      structure: { passed: false, hasNeutralCarrier: true },
      sharpnessVariance: 36.6,
      colorConfidence: 0.364,
    })).toEqual({
      passed: true,
      failures: [],
      warnings: ['structure_ambiguity'],
    });
  });

  it('keeps mildly soft localized pads readable and reports a warning', () => {
    expect(evaluateAquachekReadability({
      hasUsablePadCenters: true,
      structure: { passed: true, hasNeutralCarrier: true },
      sharpnessVariance: 2,
      colorConfidence: 0.5,
    })).toEqual({
      passed: true,
      failures: [],
      warnings: ['soft_focus'],
    });
  });

  it('still rejects evidence that cannot support a trustworthy color reading', () => {
    expect(evaluateAquachekReadability({
      hasUsablePadCenters: false,
      structure: { passed: false, hasNeutralCarrier: false },
      sharpnessVariance: 0.1,
      colorConfidence: 0.2,
    })).toEqual({
      passed: false,
      failures: [
        'missing_pad_centers',
        'missing_neutral_carrier',
        'blurry',
        'low_color_confidence',
      ],
      warnings: [],
    });
  });
});
