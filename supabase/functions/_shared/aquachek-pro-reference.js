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

/**
 * Build conservative sampling boxes around normalized pad centers reported by
 * the independent structure checks. The boxes stay well inside each pad so
 * carrier gaps and pad shadows cannot contaminate the color average.
 *
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {number[]} normalizedCenterYs
 */
export function getLocalizedPadSampleRegions(imageWidth, imageHeight, normalizedCenterYs) {
  const centers = normalizedCenterYs.map((center) => center * imageHeight);
  const sampleWidth = Math.max(12, Math.min(64, imageWidth * 0.16));

  return centers.map((centerY, index) => {
    const previousGap = index > 0 ? centerY - centers[index - 1] : Number.POSITIVE_INFINITY;
    const nextGap = index < centers.length - 1 ? centers[index + 1] - centerY : Number.POSITIVE_INFINITY;
    const nearestGap = Math.min(previousGap, nextGap);
    const finiteGap = Number.isFinite(nearestGap) ? nearestGap : imageHeight * 0.12;
    const sampleHeight = Math.max(10, Math.min(64, finiteGap * 0.38));

    return {
      x: imageWidth / 2 - sampleWidth / 2,
      y: centerY - sampleHeight / 2,
      width: sampleWidth,
      height: sampleHeight,
    };
  });
}

/**
 * Refine model-reported pad centers using the regularly spaced reagent bands
 * visible on the physical strip. Pale pads can blend into the white carrier,
 * so the detected bands may represent only a subset of the four pads.
 *
 * @param {number} imageHeight
 * @param {Array<{ startY: number, endY: number, height: number }>} colorBands
 * @param {number[] | undefined} modelCenterYs
 * @returns {number[] | undefined}
 */
export function refineAquachekProPadCenterYs(imageHeight, colorBands, modelCenterYs) {
  if (
    imageHeight <= 0 ||
    !Array.isArray(modelCenterYs) ||
    modelCenterYs.length !== 4 ||
    colorBands.length < 2 ||
    colorBands.length > 4
  ) {
    return modelCenterYs;
  }

  const bands = colorBands.map((band) => ({
    center: ((band.startY + band.endY) / 2) / imageHeight,
    weight: Math.max(0.2, band.height / Math.max(...colorBands.map((entry) => entry.height))),
  }));
  const assignments = [];
  const collectAssignments = (nextSlot, selected) => {
    if (selected.length === bands.length) {
      assignments.push(selected);
      return;
    }
    for (let slot = nextSlot; slot < 4; slot += 1) {
      collectAssignments(slot + 1, [...selected, slot]);
    }
  };
  collectAssignments(0, []);

  let best = null;
  for (const slots of assignments) {
    const weightSum = bands.reduce((sum, band) => sum + band.weight, 0);
    const meanSlot = bands.reduce((sum, band, index) => sum + band.weight * slots[index], 0) / weightSum;
    const meanCenter = bands.reduce((sum, band) => sum + band.weight * band.center, 0) / weightSum;
    const denominator = bands.reduce(
      (sum, band, index) => sum + band.weight * (slots[index] - meanSlot) ** 2,
      0,
    );
    if (denominator <= 0) continue;
    const step = bands.reduce(
      (sum, band, index) =>
        sum + band.weight * (slots[index] - meanSlot) * (band.center - meanCenter),
      0,
    ) / denominator;
    const start = meanCenter - step * meanSlot;
    const centers = Array.from({ length: 4 }, (_, index) => start + step * index);
    if (step < 0.07 || step > 0.22 || centers[0] < 0.01 || centers[3] > 0.95) continue;

    const residual = bands.reduce(
      (sum, band, index) => sum + band.weight * Math.abs(band.center - centers[slots[index]]),
      0,
    ) / weightSum;
    const modelDistance = centers.reduce(
      (sum, center, index) => sum + Math.abs(center - modelCenterYs[index]),
      0,
    ) / centers.length;
    const score = residual * 2 + modelDistance * 0.35;
    if (!best || score < best.score) best = { centers, score };
  }

  return best?.centers ?? modelCenterYs;
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

/**
 * Validate the centered strip geometry independently of the vision model.
 * Pale reagent pads may blend into the carrier, so fewer than four detected
 * color bands is allowed. Extra-long or split bands are not.
 *
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {(x: number, y: number) => Rgb} getRgb
 */
export function analyzeAquachekProStructure(imageWidth, imageHeight, getRgb) {
  const centerX = imageWidth / 2;
  const laneHalfWidth = Math.max(2, Math.round(imageWidth * 0.035));
  const averageRegion = (startY, endY) => {
    const totals = [0, 0, 0];
    let count = 0;
    for (let y = Math.max(0, Math.floor(startY)); y < Math.min(imageHeight, Math.ceil(endY)); y += 1) {
      for (
        let x = Math.max(0, Math.floor(centerX - laneHalfWidth));
        x < Math.min(imageWidth, Math.ceil(centerX + laneHalfWidth));
        x += 1
      ) {
        const rgb = getRgb(x, y);
        totals[0] += rgb[0];
        totals[1] += rgb[1];
        totals[2] += rgb[2];
        count += 1;
      }
    }
    return /** @type {Rgb} */ (totals.map((value) => (count ? value / count : 0)));
  };

  // A tight crop can place the first reagent pad inside the old fixed reference
  // window. Estimate the carrier from the brightest neutral lane rows instead,
  // which correspond to the exposed white strip between and below the pads.
  const neutralRows = [];
  for (let y = Math.floor(imageHeight * 0.08); y <= Math.ceil(imageHeight * 0.92); y += 1) {
    const row = averageRegion(y, y + 1);
    const luminance = row[0] * 0.2126 + row[1] * 0.7152 + row[2] * 0.0722;
    const chroma = Math.max(...row) - Math.min(...row);
    if (luminance >= 120 && chroma <= 55) neutralRows.push({ row, luminance });
  }
  neutralRows.sort((left, right) => right.luminance - left.luminance);
  const carrierCandidates = neutralRows.slice(
    0,
    Math.max(5, Math.ceil(neutralRows.length * 0.2)),
  );
  const carrierReference = carrierCandidates.length
    ? /** @type {Rgb} */ ([0, 1, 2].map((channel) =>
        carrierCandidates.reduce((sum, candidate) => sum + candidate.row[channel], 0) /
        carrierCandidates.length
      ))
    : averageRegion(imageHeight * 0.09, imageHeight * 0.15);
  const carrierLuminance =
    carrierReference[0] * 0.2126 + carrierReference[1] * 0.7152 + carrierReference[2] * 0.0722;
  const carrierChroma = Math.max(...carrierReference) - Math.min(...carrierReference);
  const hasNeutralCarrier = carrierLuminance >= 105 && carrierChroma <= 80;
  const expectedStep = (imageHeight * 0.6) / 4;
  const minimumBandHeight = Math.max(3, expectedStep * 0.14);
  const maximumBandHeight = expectedStep * 1.28;
  const mergeGap = Math.max(2, expectedStep * 0.08);
  const colorThreshold = 32;
  const rawBands = [];
  let activeStart = null;

  for (let y = Math.floor(imageHeight * 0.15); y <= Math.ceil(imageHeight * 0.85); y += 1) {
    const row = averageRegion(y, y + 1);
    const distance = Math.sqrt(
      (row[0] - carrierReference[0]) ** 2 +
        (row[1] - carrierReference[1]) ** 2 +
        (row[2] - carrierReference[2]) ** 2,
    );
    if (distance >= colorThreshold && activeStart === null) activeStart = y;
    if (distance < colorThreshold && activeStart !== null) {
      rawBands.push({ startY: activeStart, endY: y - 1 });
      activeStart = null;
    }
  }
  if (activeStart !== null) rawBands.push({ startY: activeStart, endY: Math.ceil(imageHeight * 0.85) });

  const mergedBands = [];
  for (const band of rawBands) {
    const previous = mergedBands.at(-1);
    if (previous && band.startY - previous.endY - 1 <= mergeGap) previous.endY = band.endY;
    else mergedBands.push({ ...band });
  }
  const colorBands = mergedBands
    .map((band) => ({ ...band, height: band.endY - band.startY + 1 }))
    .filter((band) => band.height >= minimumBandHeight);
  const hasOversizedBand = colorBands.some((band) => band.height > maximumBandHeight);
  const hasSplitOrExtraBands = colorBands.length > 4;

  return {
    passed: hasNeutralCarrier && !hasOversizedBand && !hasSplitOrExtraBands,
    hasNeutralCarrier,
    carrierReference,
    carrierLuminance,
    carrierChroma,
    colorBands,
    hasOversizedBand,
    hasSplitOrExtraBands,
    thresholds: {
      colorDistance: colorThreshold,
      minimumBandHeight,
      maximumBandHeight,
      mergeGap,
    },
  };
}

/**
 * Require at least one independent model pass to express meaningful
 * confidence in the physical strip structure. This prevents a unanimous set
 * of weak guesses from being promoted by otherwise strong color matching.
 *
 * @param {unknown[]} confidences
 * @param {number} minimumConfidence
 */
export function hasMinimumAquachekStructureConfidence(
  confidences,
  minimumConfidence = 0.5,
) {
  return confidences.some((confidence) => {
    const numericConfidence = Number(confidence);
    return Number.isFinite(numericConfidence) && numericConfidence >= minimumConfidence;
  });
}

/**
 * Estimate focus quality inside the central AquaChek strip area using the
 * variance of a five-point luminance Laplacian. This only measures spatial
 * detail; it never modifies or normalizes reagent-pad colors.
 *
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {(x: number, y: number) => Rgb} getRgb
 */
export function measureAquachekProSharpness(imageWidth, imageHeight, getRgb) {
  const startX = Math.max(1, Math.floor(imageWidth * 0.24));
  const endX = Math.min(imageWidth - 1, Math.ceil(imageWidth * 0.76));
  const startY = Math.max(1, Math.floor(imageHeight * 0.04));
  const endY = Math.min(imageHeight - 1, Math.ceil(imageHeight * 0.96));
  const luminance = (x, y) => {
    const [r, g, b] = getRgb(x, y);
    return r * 0.2126 + g * 0.7152 + b * 0.0722;
  };
  let count = 0;
  let sum = 0;
  let sumSquares = 0;

  for (let y = startY + 1; y < endY - 1; y += 1) {
    for (let x = startX + 1; x < endX - 1; x += 1) {
      const center = luminance(x, y);
      const laplacian =
        4 * center -
        luminance(x - 1, y) -
        luminance(x + 1, y) -
        luminance(x, y - 1) -
        luminance(x, y + 1);
      sum += laplacian;
      sumSquares += laplacian * laplacian;
      count += 1;
    }
  }

  const mean = count > 0 ? sum / count : 0;
  return {
    variance: count > 0 ? Math.max(0, sumSquares / count - mean * mean) : 0,
    sampleCount: count,
    region: {
      x: startX,
      y: startY,
      width: Math.max(0, endX - startX),
      height: Math.max(0, endY - startY),
    },
  };
}
