/**
 * AquaChek Pro 5-in-1 manufacturer chart and deterministic color matcher.
 *
 * This file is plain ESM so the Supabase Edge Function and the local Node test
 * harness execute the exact same reference data and matching implementation.
 */

/** @typedef {[number, number, number]} Rgb */
/** @typedef {{ value: number, rgb: Rgb }} ColorRef */

export const AQUACHEK_PRO_PAD_ORDER = Object.freeze([
  'totalChlorineAndBromine',
  'freeChlorine',
  'ph',
  'alkalinity',
]);

/** @type {ReadonlyArray<{ tc: number, bromine: number, rgb: Rgb }>} */
export const AQUACHEK_PRO_COMBINED_PAD_COLORS = Object.freeze([
  { tc: 0, bromine: 0, rgb: [254, 254, 168] },
  { tc: 0.5, bromine: 1, rgb: [242, 254, 170] },
  { tc: 1, bromine: 2, rgb: [231, 245, 160] },
  { tc: 3, bromine: 5, rgb: [184, 216, 140] },
  { tc: 5, bromine: 10, rgb: [100, 180, 105] },
  { tc: 10, bromine: 20, rgb: [55, 140, 80] },
]);

/** @type {Readonly<Record<string, ReadonlyArray<ColorRef>>>} */
export const AQUACHEK_PRO_REFS = Object.freeze({
  totalChlorine: AQUACHEK_PRO_COMBINED_PAD_COLORS.map((ref) => ({ value: ref.tc, rgb: ref.rgb })),
  bromine: AQUACHEK_PRO_COMBINED_PAD_COLORS.map((ref) => ({ value: ref.bromine, rgb: ref.rgb })),
  freeChlorine: Object.freeze([
    { value: 0, rgb: [254, 254, 204] },
    { value: 0.5, rgb: [247, 235, 228] },
    { value: 1, rgb: [235, 215, 225] },
    { value: 3, rgb: [220, 180, 210] },
    { value: 5, rgb: [190, 125, 192] },
    { value: 10, rgb: [130, 55, 160] },
    { value: 20, rgb: [70, 15, 100] },
  ]),
  ph: Object.freeze([
    { value: 6.2, rgb: [242, 200, 90] },
    { value: 6.8, rgb: [240, 170, 130] },
    { value: 7.2, rgb: [235, 150, 150] },
    { value: 7.8, rgb: [220, 130, 165] },
    { value: 8.4, rgb: [195, 110, 170] },
  ]),
  alkalinity: Object.freeze([
    { value: 0, rgb: [227, 192, 64] },
    { value: 40, rgb: [164, 169, 51] },
    { value: 80, rgb: [137, 159, 58] },
    { value: 120, rgb: [85, 130, 90] },
    { value: 180, rgb: [55, 105, 100] },
    { value: 240, rgb: [40, 90, 120] },
  ]),
});

/** @param {number} value @param {number} min @param {number} max */
export function clampColorValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** @param {Rgb} rgb @returns {[number, number, number]} */
export function rgbToLab([r, g, b]) {
  const linearize = (value) => {
    const normalized = value / 255;
    return normalized > 0.04045
      ? ((normalized + 0.055) / 1.055) ** 2.4
      : normalized / 12.92;
  };
  const rLinear = linearize(r);
  const gLinear = linearize(g);
  const bLinear = linearize(b);
  const x = rLinear * 0.4124 + gLinear * 0.3576 + bLinear * 0.1805;
  const y = rLinear * 0.2126 + gLinear * 0.7152 + bLinear * 0.0722;
  const z = rLinear * 0.0193 + gLinear * 0.1192 + bLinear * 0.9505;
  const labF = (value) => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
  const fx = labF(x / 0.95047);
  const fy = labF(y);
  const fz = labF(z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** @param {Rgb} first @param {Rgb} second */
export function deltaE76(first, second) {
  const labA = rgbToLab(first);
  const labB = rgbToLab(second);
  return Math.sqrt(
    (labA[0] - labB[0]) ** 2 +
      (labA[1] - labB[1]) ** 2 +
      (labA[2] - labB[2]) ** 2,
  );
}

/**
 * Preserves the production interpolation behavior while also returning the
 * nearest discrete chart class for validation reports.
 *
 * @param {Rgb} rgb
 * @param {ReadonlyArray<ColorRef>} refs
 */
export function bestMatch(rgb, refs) {
  if (refs.length === 0) throw new Error('At least one color reference is required.');

  const lab = rgbToLab(rgb);
  let best = refs[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  let second = refs[0];
  let secondDistance = Number.POSITIVE_INFINITY;

  for (const ref of refs) {
    const refLab = rgbToLab(ref.rgb);
    const distance = Math.sqrt(
      (lab[0] - refLab[0]) ** 2 +
        (lab[1] - refLab[1]) ** 2 +
        (lab[2] - refLab[2]) ** 2,
    );
    if (distance < bestDistance) {
      second = best;
      secondDistance = bestDistance;
      best = ref;
      bestDistance = distance;
    } else if (distance < secondDistance) {
      second = ref;
      secondDistance = distance;
    }
  }

  const totalDistance = bestDistance + secondDistance;
  const bestWeight = totalDistance > 0 ? secondDistance / totalDistance : 1;
  const value = best.value * bestWeight + second.value * (1 - bestWeight);
  return {
    value,
    distance: bestDistance,
    nearestValue: best.value,
    secondValue: second.value,
    margin: secondDistance - bestDistance,
  };
}

/** @param {number[]} distances */
export function confidenceFromDistances(distances) {
  const averageDistance = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
  return clampColorValue(1 - averageDistance / 50, 0.18, 0.95);
}

/**
 * Remove a neutral lighting cast by using the unreacted white strip body as a
 * reference. The mean luminance is preserved, so this does not manufacture a
 * brighter/darker reagent result.
 *
 * @param {Rgb[]} pads
 * @param {Rgb | undefined} whiteReference
 */
export function normalizePadsWithWhiteReference(pads, whiteReference) {
  if (!whiteReference) return pads;
  const average = whiteReference.reduce((sum, channel) => sum + channel, 0) / 3;
  const spread = Math.max(...whiteReference) - Math.min(...whiteReference);
  if (average < 140 || spread > 80 || whiteReference.some((channel) => channel < 1)) return pads;

  const nominalStripWhite = 245;
  const factors = whiteReference.map((channel) =>
    clampColorValue(nominalStripWhite / channel, 0.85, 1.18),
  );
  return pads.map((pad) =>
    pad.map((channel, index) => clampColorValue(channel * factors[index], 0, 255)),
  );
}

/**
 * Analyze four already-localized physical pads in wet-tip-to-handle order.
 * @param {Rgb[]} pads
 * @param {{ whiteReference?: Rgb }} [options]
 */
export function analyzeAquachekProPadRgbs(pads, options = {}) {
  if (pads.length !== 4) {
    throw new Error(`AquaChek Pro requires exactly 4 physical pads; received ${pads.length}.`);
  }

  const normalizedPads = normalizePadsWithWhiteReference(pads, options.whiteReference);
  const calibratedMatch = (padIndex, refs) => {
    const rawMatch = bestMatch(pads[padIndex], refs);
    const normalizedMatch = bestMatch(normalizedPads[padIndex], refs);
    return normalizedMatch.margin > rawMatch.margin ? normalizedMatch : rawMatch;
  };
  const totalChlorine = calibratedMatch(0, AQUACHEK_PRO_REFS.totalChlorine);
  const bromine = calibratedMatch(0, AQUACHEK_PRO_REFS.bromine);
  const freeChlorine = calibratedMatch(1, AQUACHEK_PRO_REFS.freeChlorine);
  const ph = calibratedMatch(2, AQUACHEK_PRO_REFS.ph);
  const alkalinity = calibratedMatch(3, AQUACHEK_PRO_REFS.alkalinity);

  return {
    values: {
      totalChlorine: Number(totalChlorine.value.toFixed(1)),
      bromine: Number(bromine.value.toFixed(1)),
      freeChlorine: Number(freeChlorine.value.toFixed(1)),
      ph: Number(ph.value.toFixed(1)),
      alkalinity: Math.round(alkalinity.value),
    },
    nearestValues: {
      totalChlorine: totalChlorine.nearestValue,
      bromine: bromine.nearestValue,
      freeChlorine: freeChlorine.nearestValue,
      ph: ph.nearestValue,
      alkalinity: alkalinity.nearestValue,
    },
    distances: {
      totalChlorine: totalChlorine.distance,
      freeChlorine: freeChlorine.distance,
      ph: ph.distance,
      alkalinity: alkalinity.distance,
    },
    margins: {
      totalChlorine: totalChlorine.margin,
      freeChlorine: freeChlorine.margin,
      ph: ph.margin,
      alkalinity: alkalinity.margin,
    },
    confidence: confidenceFromDistances([
      totalChlorine.distance,
      freeChlorine.distance,
      ph.distance,
      alkalinity.distance,
    ]),
  };
}

/**
 * Production-safe AquaChek result. Readings are always discrete levels that
 * exist on the manufacturer chart; interpolated values remain diagnostics.
 * @param {Rgb[]} pads
 * @param {{ whiteReference?: Rgb }} [options]
 */
export function analyzeAquachekProDiscretePadRgbs(pads, options = {}) {
  const analysis = analyzeAquachekProPadRgbs(pads, options);
  return {
    ...analysis,
    values: { ...analysis.nearestValues },
  };
}

/**
 * Fixed sampling geometry used by the production CV fallback and fixtures.
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {number} padCount
 */
export function getFixedPadSampleRegions(imageWidth, imageHeight, padCount = 4) {
  const centerX = imageWidth / 2;
  const top = imageHeight * 0.2;
  const padStep = (imageHeight * 0.6) / padCount;
  const sampleWidth = Math.max(20, Math.min(64, imageWidth * 0.05));
  const sampleHeight = Math.max(20, Math.min(64, padStep * 0.5));

  return Array.from({ length: padCount }, (_, index) => ({
    x: centerX - sampleWidth / 2,
    y: top + padStep * (index + 0.5) - sampleHeight / 2,
    width: sampleWidth,
    height: sampleHeight,
  }));
}

/** @param {number} imageWidth @param {number} imageHeight */
export function getFixedWhiteReferenceRegion(imageWidth, imageHeight) {
  const width = Math.max(16, Math.min(40, imageWidth * 0.04));
  const height = Math.max(12, Math.min(24, imageHeight * 0.04));
  return {
    x: imageWidth / 2 - width / 2,
    y: imageHeight * 0.12 - height / 2,
    width,
    height,
  };
}
