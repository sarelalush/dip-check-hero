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
 * @param {number} [normalizedCenterX]
 */
export function getLocalizedPadSampleRegions(
  imageWidth,
  imageHeight,
  normalizedCenterYs,
  normalizedCenterX = 0.5,
) {
  const centers = normalizedCenterYs.map((center) => center * imageHeight);
  const sampleWidth = Math.max(12, Math.min(64, imageWidth * 0.16));
  const centerX = Math.max(0, Math.min(1, normalizedCenterX)) * imageWidth;

  return centers.map((centerY, index) => {
    const previousGap = index > 0 ? centerY - centers[index - 1] : Number.POSITIVE_INFINITY;
    const nextGap = index < centers.length - 1 ? centers[index + 1] - centerY : Number.POSITIVE_INFINITY;
    const nearestGap = Math.min(previousGap, nextGap);
    const finiteGap = Number.isFinite(nearestGap) ? nearestGap : imageHeight * 0.12;
    const sampleHeight = Math.max(10, Math.min(64, finiteGap * 0.38));

    return {
      x: centerX - sampleWidth / 2,
      y: centerY - sampleHeight / 2,
      width: sampleWidth,
      height: sampleHeight,
    };
  });
}

/**
 * Locate the strip horizontally from the exposed white carrier between pads.
 * This makes color sampling independent of small differences in a user's crop.
 * The internal gaps are much more reliable than the outer background because
 * they must all belong to the same continuous strip body.
 *
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {(x: number, y: number) => Rgb} getRgb
 * @param {number[] | undefined} normalizedCenterYs
 * @returns {{ centerX: number, normalizedCenterX: number, confidence: number, segment: { startX: number, endX: number } | null }}
 */
export function locateAquachekProStripCenterX(
  imageWidth,
  imageHeight,
  getRgb,
  normalizedCenterYs,
) {
  const fallbackCenterX = imageWidth / 2;
  if (
    imageWidth < 8 ||
    imageHeight < 8 ||
    !Array.isArray(normalizedCenterYs) ||
    normalizedCenterYs.length !== 4
  ) {
    return {
      centerX: fallbackCenterX,
      normalizedCenterX: 0.5,
      confidence: 0,
      segment: null,
    };
  }

  const centers = normalizedCenterYs
    .map((center) => Math.max(0, Math.min(1, Number(center))))
    .sort((left, right) => left - right);
  const internalGapRows = centers.slice(0, -1).map((center, index) =>
    Math.round(((center + centers[index + 1]) / 2) * imageHeight)
  );
  const gaps = centers.slice(1).map((center, index) => center - centers[index]);
  const sortedGaps = [...gaps].sort((left, right) => left - right);
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)];
  const handleStart = centers.at(-1) + medianGap * 0.45;
  const handleEnd = Math.min(0.94, centers.at(-1) + medianGap * 1.65);
  const handleRows = handleEnd > handleStart + 0.03
    ? Array.from({ length: 9 }, (_, index) =>
        Math.round((handleStart + (handleEnd - handleStart) * (index / 8)) * imageHeight)
      )
    : [];
  // A long exposed handle is the strongest horizontal locator. Tight crops
  // may omit it, in which case the three internal carrier gaps remain enough.
  const gapRows = [...internalGapRows, ...handleRows];
  const rowRadius = Math.max(1, Math.min(4, Math.round(imageHeight * 0.004)));
  const laneRadius = Math.max(1, Math.min(3, Math.round(imageWidth * 0.008)));
  const scores = [];

  for (let x = 0; x < imageWidth; x += 1) {
    let total = 0;
    for (const centerY of gapRows) {
      const channels = [0, 0, 0];
      let count = 0;
      for (let y = centerY - rowRadius; y <= centerY + rowRadius; y += 1) {
        if (y < 0 || y >= imageHeight) continue;
        for (let sampleX = x - laneRadius; sampleX <= x + laneRadius; sampleX += 1) {
          if (sampleX < 0 || sampleX >= imageWidth) continue;
          const rgb = getRgb(sampleX, y);
          channels[0] += rgb[0];
          channels[1] += rgb[1];
          channels[2] += rgb[2];
          count += 1;
        }
      }
      const rgb = channels.map((channel) => channel / Math.max(1, count));
      const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      const chroma = Math.max(...rgb) - Math.min(...rgb);
      const brightnessScore = Math.max(0, Math.min(1, (luminance - 145) / 90));
      const neutralityScore = Math.max(0, Math.min(1, (70 - chroma) / 55));
      total += brightnessScore * neutralityScore;
    }
    scores.push(total / gapRows.length);
  }

  const maximumScore = Math.max(...scores);
  if (!Number.isFinite(maximumScore) || maximumScore < 0.28) {
    return {
      centerX: fallbackCenterX,
      normalizedCenterX: 0.5,
      confidence: 0,
      segment: null,
    };
  }

  const threshold = Math.max(0.28, maximumScore * 0.82);
  const segments = [];
  let activeStart = null;
  for (let x = 0; x <= imageWidth; x += 1) {
    const isActive = x < imageWidth && scores[x] >= threshold;
    if (isActive && activeStart === null) activeStart = x;
    if (!isActive && activeStart !== null) {
      const endX = x - 1;
      if (endX - activeStart + 1 >= Math.max(3, imageWidth * 0.025)) {
        const segmentScores = scores.slice(activeStart, endX + 1);
        segments.push({
          startX: activeStart,
          endX,
          averageScore:
            segmentScores.reduce((sum, score) => sum + score, 0) / segmentScores.length,
        });
      }
      activeStart = null;
    }
  }

  if (segments.length === 0) {
    const centerX = scores.indexOf(maximumScore);
    return {
      centerX,
      normalizedCenterX: centerX / imageWidth,
      confidence: maximumScore * 0.5,
      segment: { startX: centerX, endX: centerX },
    };
  }

  const selected = segments.reduce((best, segment) => {
    const segmentCenter = (segment.startX + segment.endX) / 2;
    const centerDistance = Math.abs(segmentCenter - fallbackCenterX) / imageWidth;
    const width = segment.endX - segment.startX + 1;
    const plausibleWidth = Math.min(1, width / Math.max(1, imageWidth * 0.18));
    const rank = segment.averageScore + plausibleWidth * 0.08 - centerDistance * 0.12;
    return !best || rank > best.rank ? { ...segment, rank } : best;
  }, null);
  const centerX = (selected.startX + selected.endX) / 2;

  return {
    centerX,
    normalizedCenterX: centerX / imageWidth,
    confidence: Math.max(0, Math.min(1, selected.averageScore)),
    segment: { startX: selected.startX, endX: selected.endX },
  };
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

  const maximumBandHeight = Math.max(...colorBands.map((entry) => entry.height));
  const bands = colorBands.map((band) => ({
    center: ((band.startY + band.endY) / 2) / imageHeight,
    // A pale pad often produces only a short colored fragment near one edge.
    // Squared weighting lets complete bands define the regular four-pad grid
    // without allowing those partial fragments to pull a center downward.
    weight: Math.max(0.05, (band.height / maximumBandHeight) ** 2),
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
 * Keep reagent-like bands inside the four-pad area already grounded by the
 * vision model. A user's fingers or the exposed handle can be colorful too,
 * but they sit well outside the regular reagent sequence and must not be
 * counted as a fifth pad.
 *
 * Filtering is only enabled when at least two plausible reagent bands remain.
 * This prevents incorrect model centers from hiding real structural defects.
 *
 * @param {number} imageHeight
 * @param {Array<{ startY: number, endY: number, height: number }>} colorBands
 * @param {number[] | undefined} modelCenterYs
 */
export function selectAquachekProExpectedColorBands(imageHeight, colorBands, modelCenterYs) {
  if (
    imageHeight <= 0 ||
    !Array.isArray(modelCenterYs) ||
    modelCenterYs.length !== 4 ||
    modelCenterYs.some((center) => !Number.isFinite(Number(center)))
  ) {
    return { colorBands, ignoredColorBands: [], expectedBandEnvelope: null };
  }

  const centers = modelCenterYs
    .map((center) => Math.max(0, Math.min(1, Number(center))))
    .sort((left, right) => left - right);
  const gaps = centers.slice(1).map((center, index) => center - centers[index]);
  const sortedGaps = [...gaps].sort((left, right) => left - right);
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)];
  if (!Number.isFinite(medianGap) || medianGap < 0.04 || medianGap > 0.28) {
    return { colorBands, ignoredColorBands: [], expectedBandEnvelope: null };
  }

  const envelopePadding = medianGap * 0.8;
  const expectedBandEnvelope = {
    startY: Math.max(0, (centers[0] - envelopePadding) * imageHeight),
    endY: Math.min(imageHeight - 1, (centers[3] + envelopePadding) * imageHeight),
  };
  const isInsideEnvelope = (band) => {
    const centerY = (band.startY + band.endY) / 2;
    return centerY >= expectedBandEnvelope.startY && centerY <= expectedBandEnvelope.endY;
  };
  const expectedBands = colorBands.filter(isInsideEnvelope);
  if (expectedBands.length < 2) {
    return { colorBands, ignoredColorBands: [], expectedBandEnvelope: null };
  }

  return {
    colorBands: expectedBands,
    ignoredColorBands: colorBands.filter((band) => !isInsideEnvelope(band)),
    expectedBandEnvelope,
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
 * @param {number} [requestedCenterX]
 * @param {number[] | undefined} [modelCenterYs]
 */
export function analyzeAquachekProStructure(
  imageWidth,
  imageHeight,
  getRgb,
  requestedCenterX = imageWidth / 2,
  modelCenterYs,
) {
  const centerX = Math.max(0, Math.min(imageWidth - 1, requestedCenterX));
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
  const allColorBands = mergedBands
    .map((band) => ({ ...band, height: band.endY - band.startY + 1 }))
    .filter((band) => band.height >= minimumBandHeight);
  const selectedBands = selectAquachekProExpectedColorBands(
    imageHeight,
    allColorBands,
    modelCenterYs,
  );
  const colorBands = selectedBands.colorBands;
  const hasOversizedBand = colorBands.some((band) => band.height > maximumBandHeight);
  const hasSplitOrExtraBands = colorBands.length > 4;

  return {
    passed: hasNeutralCarrier && !hasOversizedBand && !hasSplitOrExtraBands,
    hasNeutralCarrier,
    carrierReference,
    carrierLuminance,
    carrierChroma,
    colorBands,
    ignoredColorBands: selectedBands.ignoredColorBands,
    expectedBandEnvelope: selectedBands.expectedBandEnvelope,
    hasOversizedBand,
    hasSplitOrExtraBands,
    thresholds: {
      colorDistance: colorThreshold,
      minimumBandHeight,
      maximumBandHeight,
      mergeGap,
    },
    centerX,
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
 * Accept model evidence that is strong enough for the deterministic AquaChek
 * structure and color analyzers to make the final decision. Real phone photos
 * often make the neutral carrier look ambiguous even when all four intact pads
 * are plainly visible, so subjective framing/body flags are not hard failures.
 *
 * @param {Record<string, unknown> | null | undefined} evidence
 * @param {number} expectedPadCount
 */
export function hasUsableAquachekPadEvidence(evidence, expectedPadCount = 4) {
  const centers = Array.isArray(evidence?.visiblePadCenterYs)
    ? evidence.visiblePadCenterYs
    : [];
  const integrity = Array.isArray(evidence?.padIntegrity)
    ? evidence.padIntegrity
    : [];
  const physicalPadCount = Number(evidence?.physicalPadCount ?? 0);
  const exactPadCount =
    physicalPadCount === expectedPadCount || centers.length === expectedPadCount;
  const padsAreIntact =
    integrity.length === expectedPadCount
      ? integrity.every(Boolean)
      : evidence?.allPadsIntact === true;

  return (
    exactPadCount &&
    evidence?.hasExactlyOneStrip === true &&
    padsAreIntact &&
    evidence?.padOrderMatchesSelectedBrand === true &&
    evidence?.hasExtraPadLikeRegions === false &&
    evidence?.stripBodyEvidence !== 'none'
  );
}

/**
 * Estimate focus quality inside the central AquaChek strip area using the
 * variance of a five-point luminance Laplacian. This only measures spatial
 * detail; it never modifies or normalizes reagent-pad colors.
 *
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {(x: number, y: number) => Rgb} getRgb
 * @param {number} [requestedCenterX]
 */
export function measureAquachekProSharpness(
  imageWidth,
  imageHeight,
  getRgb,
  requestedCenterX = imageWidth / 2,
) {
  const centerX = Math.max(0, Math.min(imageWidth - 1, requestedCenterX));
  const halfWidth = Math.max(8, imageWidth * 0.26);
  const startX = Math.max(1, Math.floor(centerX - halfWidth));
  const endX = Math.min(imageWidth - 1, Math.ceil(centerX + halfWidth));
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
