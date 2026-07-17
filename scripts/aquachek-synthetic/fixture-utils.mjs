import { PNG } from 'pngjs';

import {
  AQUACHEK_PRO_COMBINED_PAD_COLORS,
  AQUACHEK_PRO_REFS,
  clampColorValue,
  getFixedPadSampleRegions,
  getFixedWhiteReferenceRegion,
} from '../../supabase/functions/_shared/aquachek-pro-reference.js';

export const FIXTURE_WIDTH = 96;
export const FIXTURE_HEIGHT = 288;

export const VALID_VARIANTS = Object.freeze([
  { id: 'canonical', tier: 'canonical' },
  { id: 'dim', tier: 'controlled', exposure: 0.94 },
  { id: 'bright', tier: 'controlled', exposure: 1.02 },
  { id: 'warm', tier: 'controlled', cast: [1.03, 1, 0.97] },
  { id: 'cool', tier: 'controlled', cast: [0.97, 1, 1.03] },
  { id: 'tilt-left', tier: 'geometry', tiltDegrees: -1.5 },
  { id: 'tilt-right', tier: 'geometry', tiltDegrees: 1.5 },
]);

const INVALID_DEFINITIONS = Object.freeze([
  { id: 'no-strip', expectedFailureReason: 'strip_not_detected', hideStrip: true },
  { id: 'missing-pad', expectedFailureReason: 'pad_count_mismatch', omitPad: 1 },
  { id: 'cropped-top', expectedFailureReason: 'strip_cropped', shiftY: -90 },
  { id: 'too-small', expectedFailureReason: 'strip_too_small', widthScale: 0.35 },
  { id: 'strong-glare', expectedFailureReason: 'strong_glare', glare: 0.92 },
  { id: 'large-tilt', expectedFailureReason: 'strip_not_straight', tiltDegrees: 18 },
]);

function safeId(value) {
  return String(value).replaceAll('.', 'p').replaceAll('-', 'm');
}

export function hashSeed(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function transformRgb(rgb, variant, random) {
  const exposure = variant.exposure ?? 1;
  const cast = variant.cast ?? [1, 1, 1];
  const jitter = variant.jitter ?? 0;
  return rgb.map((channel, index) =>
    Math.round(
      clampColorValue(
        channel * exposure * cast[index] + (random() * 2 - 1) * jitter,
        0,
        255,
      ),
    ),
  );
}

function setPixel(png, x, y, rgb, alpha = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const offset = (png.width * y + x) * 4;
  png.data[offset] = rgb[0];
  png.data[offset + 1] = rgb[1];
  png.data[offset + 2] = rgb[2];
  png.data[offset + 3] = alpha;
}

function poolBackground(x, y, width, height) {
  const band = Math.floor((y / height) * 10) % 2;
  const highlight = Math.abs((x % 30) - 15) < 2 ? 10 : 0;
  return [20 + highlight, 132 + band * 7 + highlight, 172 + band * 6 + highlight];
}

export function enumerateCanonicalCases() {
  const cases = [];
  for (const combined of AQUACHEK_PRO_COMBINED_PAD_COLORS) {
    for (const freeChlorine of AQUACHEK_PRO_REFS.freeChlorine) {
      for (const ph of AQUACHEK_PRO_REFS.ph) {
        for (const alkalinity of AQUACHEK_PRO_REFS.alkalinity) {
          const id = [
            `tc-${safeId(combined.tc)}`,
            `br-${safeId(combined.bromine)}`,
            `fc-${safeId(freeChlorine.value)}`,
            `ph-${safeId(ph.value)}`,
            `alk-${safeId(alkalinity.value)}`,
          ].join('_');
          cases.push({
            id,
            expected: {
              totalChlorine: combined.tc,
              bromine: combined.bromine,
              freeChlorine: freeChlorine.value,
              ph: ph.value,
              alkalinity: alkalinity.value,
            },
            padRgbs: [combined.rgb, freeChlorine.rgb, ph.rgb, alkalinity.rgb],
          });
        }
      }
    }
  }
  return cases;
}

export function selectStressCases(cases, divisor = 6) {
  return cases.filter((testCase) => hashSeed(testCase.id) % divisor === 0);
}

export function renderSyntheticColors(testCase, variant = VALID_VARIANTS[0]) {
  const random = mulberry32(hashSeed(`${testCase.id}:${variant.id}`));
  return {
    padRgbs: testCase.padRgbs.map((rgb) => transformRgb(rgb, variant, random)),
    whiteReference: transformRgb([245, 245, 245], variant, random),
  };
}

export function renderSyntheticStrip(testCase, variant = VALID_VARIANTS[0]) {
  const png = new PNG({ width: FIXTURE_WIDTH, height: FIXTURE_HEIGHT });
  const regions = getFixedPadSampleRegions(FIXTURE_WIDTH, FIXTURE_HEIGHT, 4);
  const { padRgbs: transformedPads, whiteReference: transformedBody } = renderSyntheticColors(
    testCase,
    variant,
  );
  const tilt = Math.tan(((variant.tiltDegrees ?? 0) * Math.PI) / 180);
  const stripHalfWidth = 18 * (variant.widthScale ?? 1);
  const bodyTop = 15 + (variant.shiftY ?? 0);
  const bodyBottom = FIXTURE_HEIGHT - 15 + (variant.shiftY ?? 0);

  for (let y = 0; y < FIXTURE_HEIGHT; y += 1) {
    for (let x = 0; x < FIXTURE_WIDTH; x += 1) {
      let color = poolBackground(x, y, FIXTURE_WIDTH, FIXTURE_HEIGHT);
      const centerX = FIXTURE_WIDTH / 2 + tilt * (y - FIXTURE_HEIGHT / 2);
      const localX = x - centerX;
      const withinBody =
        !variant.hideStrip &&
        y >= bodyTop &&
        y <= bodyBottom &&
        Math.abs(localX) <= stripHalfWidth;

      if (withinBody) color = transformedBody;

      for (let padIndex = 0; padIndex < regions.length; padIndex += 1) {
        if (!withinBody || variant.omitPad === padIndex) continue;
        const padCenterY = regions[padIndex].y + regions[padIndex].height / 2 + (variant.shiftY ?? 0);
        const padHalfHeight = regions[padIndex].height / 2 + 5;
        if (Math.abs(y - padCenterY) <= padHalfHeight && Math.abs(localX) <= stripHalfWidth - 2) {
          color = transformedPads[padIndex];
          const glare = variant.glare ?? 0;
          if (glare > 0 && Math.abs(localX + stripHalfWidth * 0.2) < stripHalfWidth * 0.28) {
            color = color.map((channel) => Math.round(channel * (1 - glare) + 255 * glare));
          }
        }
      }

      setPixel(png, x, y, color);
    }
  }

  return { png, transformedPads };
}

export function sampleFixturePads(png) {
  return getFixedPadSampleRegions(png.width, png.height, 4).map((region) => {
    const startX = Math.max(0, Math.floor(region.x));
    const endX = Math.min(png.width, Math.ceil(region.x + region.width));
    const startY = Math.max(0, Math.floor(region.y));
    const endY = Math.min(png.height, Math.ceil(region.y + region.height));
    const totals = [0, 0, 0];
    let count = 0;
    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const offset = (png.width * y + x) * 4;
        totals[0] += png.data[offset];
        totals[1] += png.data[offset + 1];
        totals[2] += png.data[offset + 2];
        count += 1;
      }
    }
    return totals.map((total) => Math.round(total / count));
  });
}

export function sampleFixtureWhiteReference(png) {
  const region = getFixedWhiteReferenceRegion(png.width, png.height);
  const startX = Math.max(0, Math.floor(region.x));
  const endX = Math.min(png.width, Math.ceil(region.x + region.width));
  const startY = Math.max(0, Math.floor(region.y));
  const endY = Math.min(png.height, Math.ceil(region.y + region.height));
  const totals = [0, 0, 0];
  let count = 0;
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const offset = (png.width * y + x) * 4;
      totals[0] += png.data[offset];
      totals[1] += png.data[offset + 1];
      totals[2] += png.data[offset + 2];
      count += 1;
    }
  }
  return totals.map((total) => Math.round(total / count));
}

export function buildInvalidFixtures(referenceCase) {
  return INVALID_DEFINITIONS.map((definition) => ({
    id: `invalid_${definition.id}`,
    valid: false,
    tier: 'invalid',
    expectedFailureReason: definition.expectedFailureReason,
    variant: definition,
    sourceCase: referenceCase,
  }));
}

export function writePng(png) {
  return PNG.sync.write(png, { colorType: 6, inputColorType: 6 });
}

export function readPng(buffer) {
  return PNG.sync.read(buffer);
}

export function buildContactSheet(entries, columns = 5, gap = 8) {
  const rows = Math.ceil(entries.length / columns);
  const labelHeight = 18;
  const cellWidth = FIXTURE_WIDTH + gap;
  const cellHeight = FIXTURE_HEIGHT + labelHeight + gap;
  const sheet = new PNG({ width: columns * cellWidth + gap, height: rows * cellHeight + gap });
  sheet.data.fill(245);

  entries.forEach(({ png }, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const targetX = gap + column * cellWidth;
    const targetY = gap + row * cellHeight;
    PNG.bitblt(png, sheet, 0, 0, png.width, png.height, targetX, targetY);
  });

  return sheet;
}
