import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';

import {
  buildContactSheet,
  enumerateCanonicalCases,
  hashSeed,
  renderSyntheticStrip,
  writePng,
} from './fixture-utils.mjs';
import { getFixedPadSampleRegions } from '../../supabase/functions/_shared/aquachek-pro-reference.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');
const sourceDatasetDirectory = path.join(repositoryRoot, 'work/aquachek-synthetic-dataset');
const runDirectory = path.join(repositoryRoot, 'work/aquachek-gemini-adversarial-100');
const validDirectory = path.join(runDirectory, 'valid');
const invalidDirectory = path.join(runDirectory, 'invalid');
const checkpointPath = path.join(runDirectory, 'results.jsonl');
const reportJsonPath = path.join(runDirectory, 'report.json');
const reportMarkdownPath = path.join(runDirectory, 'report.md');
const selectedManifestPath = path.join(runDirectory, 'selected-manifest.json');
const previousReportPath = path.join(repositoryRoot, 'work/aquachek-gemini-e2e-latest.json');

function parseEnvFile(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^['\"]|['\"]$/g, '')];
      }),
  );
}

async function readOptionalText(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

const linkedProjectRef = (await readOptionalText(
  path.join(repositoryRoot, 'supabase/.temp/project-ref'),
)).trim();
const mobileEnv = parseEnvFile(
  await readOptionalText(path.join(repositoryRoot, 'mobile/.env')),
);
const mobileSupabaseUrl = mobileEnv.EXPO_PUBLIC_SUPABASE_URL;
const mobileMatchesLinkedProject =
  Boolean(linkedProjectRef) && mobileSupabaseUrl?.includes(`${linkedProjectRef}.supabase.co`);
const SUPABASE_URL =
  process.env.E2E_SUPABASE_URL ||
  (mobileMatchesLinkedProject ? mobileSupabaseUrl : process.env.SUPABASE_URL);
const SUPABASE_ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY ||
  (mobileMatchesLinkedProject
    ? mobileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY
    : process.env.SUPABASE_ANON_KEY);
const ENDPOINT = `${SUPABASE_URL}/functions/v1/analyze-strip`;
const RUN_ID = process.env.E2E_RUN_ID || 'aquachek-production-adversarial-100-v1';
const CONCURRENCY = Math.max(1, Math.min(4, Number(process.env.E2E_CONCURRENCY || 2)));
const RESET = process.env.RESET_ADVERSARIAL === '1';
const PREPARE_ONLY = process.env.E2E_PREPARE_ONLY === '1';
const SMOKE_ONLY = process.env.E2E_SMOKE_ONLY === '1';
const PARAMS = ['totalChlorine', 'bromine', 'freeChlorine', 'ph', 'alkalinity'];
const VALID_PER_VARIANT = 10;
const INVALID_PER_VARIANT = 5;
const TOTAL_FIXTURES = 100;
const EXPECTED_MODEL = 'gemini-2.5-flash';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Production Supabase URL and anon key are required.');
}

if (linkedProjectRef && !SUPABASE_URL.includes(`${linkedProjectRef}.supabase.co`)) {
  throw new Error(
    `Refusing to run production E2E against a project other than linked ref ${linkedProjectRef}.`,
  );
}

function seededRank(value, namespace) {
  return hashSeed(`${RUN_ID}:${namespace}:${value}`);
}

function clonePng(source) {
  const clone = new PNG({ width: source.width, height: source.height });
  source.data.copy(clone.data);
  return clone;
}

function setPixel(png, x, y, rgba) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const offset = (y * png.width + x) * 4;
  png.data[offset] = rgba[0];
  png.data[offset + 1] = rgba[1];
  png.data[offset + 2] = rgba[2];
  png.data[offset + 3] = rgba[3] ?? 255;
}

function getPixel(png, x, y) {
  const clampedX = Math.max(0, Math.min(png.width - 1, x));
  const clampedY = Math.max(0, Math.min(png.height - 1, y));
  const offset = (clampedY * png.width + clampedX) * 4;
  return [
    png.data[offset],
    png.data[offset + 1],
    png.data[offset + 2],
    png.data[offset + 3],
  ];
}

function varyWholeImage(source, index) {
  const result = clonePng(source);
  const exposure = 0.91 + (index % 5) * 0.035;
  const casts = [
    [1.03, 1, 0.97],
    [0.97, 1, 1.03],
    [1, 1, 1],
  ];
  const cast = casts[index % casts.length];
  const seed = hashSeed(`${RUN_ID}:pixel-variation:${index}`);
  for (let offset = 0; offset < result.data.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const noise = ((seed + offset * 17 + channel * 31) % 7) - 3;
      result.data[offset + channel] = Math.max(
        0,
        Math.min(255, Math.round(result.data[offset + channel] * exposure * cast[channel] + noise)),
      );
    }
  }
  return result;
}

function makeTooSmall(testCase, index) {
  const background = renderSyntheticStrip(testCase, {
    id: `invalid-too-small-background-${index}`,
    hideStrip: true,
  }).png;
  const source = renderSyntheticStrip(testCase, { id: `invalid-too-small-source-${index}` }).png;
  const sourceX = 28;
  const sourceY = 15;
  const sourceWidth = 40;
  const sourceHeight = 258;
  const targetWidth = 8 + (index % 3);
  const targetHeight = 72 + (index % 4) * 6;
  const targetX = Math.round((background.width - targetWidth) / 2);
  const targetY = Math.round((background.height - targetHeight) / 2);

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sampleX = sourceX + Math.floor((x / targetWidth) * sourceWidth);
      const sampleY = sourceY + Math.floor((y / targetHeight) * sourceHeight);
      setPixel(background, targetX + x, targetY + y, getPixel(source, sampleX, sampleY));
    }
  }
  return varyWholeImage(background, index);
}

function applyStrongGlare(source, index) {
  const result = varyWholeImage(source, index);
  const centerX = result.width / 2;
  const halfWidth = 15 + (index % 3);
  const startY = 38 - (index % 3) * 4;
  const endY = 226 + (index % 4) * 5;
  const strength = 0.86 + (index % 3) * 0.04;
  for (let y = startY; y <= endY; y += 1) {
    for (let x = Math.floor(centerX - halfWidth); x <= Math.ceil(centerX + halfWidth); x += 1) {
      const original = getPixel(result, x, y);
      const edge = Math.abs(x - centerX) / halfWidth;
      const localStrength = strength * (1 - Math.max(0, edge - 0.72));
      setPixel(result, x, y, [
        Math.round(original[0] * (1 - localStrength) + 255 * localStrength),
        Math.round(original[1] * (1 - localStrength) + 255 * localStrength),
        Math.round(original[2] * (1 - localStrength) + 255 * localStrength),
        original[3],
      ]);
    }
  }
  return result;
}

function applyBoxBlur(source, radius) {
  const result = new PNG({ width: source.width, height: source.height });
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const totals = [0, 0, 0, 0];
      let count = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const pixel = getPixel(source, x + dx, y + dy);
          for (let channel = 0; channel < 4; channel += 1) totals[channel] += pixel[channel];
          count += 1;
        }
      }
      setPixel(result, x, y, totals.map((total) => Math.round(total / count)));
    }
  }
  return result;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function drawRect(png, left, top, width, height, rgba) {
  for (let y = Math.max(0, top); y < Math.min(png.height, top + height); y += 1) {
    for (let x = Math.max(0, left); x < Math.min(png.width, left + width); x += 1) {
      setPixel(png, x, y, rgba);
    }
  }
}

function deterministicNoise(source, seedText, amplitude = 10, quantize = 1) {
  const result = clonePng(source);
  let state = hashSeed(seedText) || 1;
  for (let offset = 0; offset < result.data.length; offset += 4) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const noise = ((state >>> (channel * 7)) % (amplitude * 2 + 1)) - amplitude;
      const value = clampByte(result.data[offset + channel] + noise);
      result.data[offset + channel] = clampByte(Math.round(value / quantize) * quantize);
    }
  }
  return result;
}

function applyUnevenLight(source, index) {
  const result = clonePng(source);
  const direction = index % 2 === 0 ? 1 : -1;
  for (let y = 0; y < result.height; y += 1) {
    for (let x = 0; x < result.width; x += 1) {
      const offset = (y * result.width + x) * 4;
      const horizontal = ((x / Math.max(1, result.width - 1)) - 0.5) * 0.16 * direction;
      const vertical = Math.sin((y / result.height) * Math.PI) * 0.04;
      const multiplier = 0.96 + horizontal + vertical;
      for (let channel = 0; channel < 3; channel += 1) {
        result.data[offset + channel] = clampByte(result.data[offset + channel] * multiplier);
      }
    }
  }
  return deterministicNoise(result, `${RUN_ID}:uneven:${index}`, 3);
}

function applyPadTexture(source, index) {
  const result = deterministicNoise(source, `${RUN_ID}:texture-base:${index}`, 4);
  const regions = getFixedPadSampleRegions(result.width, result.height, 4);
  for (let padIndex = 0; padIndex < regions.length; padIndex += 1) {
    const region = regions[padIndex];
    const left = Math.floor(region.x - 7);
    const top = Math.floor(region.y - 5);
    const right = Math.ceil(region.x + region.width + 7);
    const bottom = Math.ceil(region.y + region.height + 5);
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        if ((x * 13 + y * 7 + index * 11) % 9 !== 0) continue;
        const pixel = getPixel(result, x, y);
        const delta = ((x + y + padIndex) % 2 === 0 ? 1 : -1) * 14;
        setPixel(result, x, y, pixel.slice(0, 3).map((value) => clampByte(value + delta)));
      }
    }
  }
  return result;
}

function addBackgroundDecoys(source, index) {
  const result = deterministicNoise(source, `${RUN_ID}:decoy:${index}`, 3);
  const colors = [
    [150, 98, 180, 255],
    [207, 92, 72, 255],
    [92, 142, 92, 255],
    [196, 172, 72, 255],
  ];
  for (let padIndex = 0; padIndex < 4; padIndex += 1) {
    const y = 48 + padIndex * 52 + (index % 3) * 2;
    const x = padIndex % 2 === 0 ? 3 : 78;
    drawRect(result, x, y, 14, 18, colors[(padIndex + index) % colors.length]);
  }
  return result;
}

function buildHardValidImage(kind, testCase, index) {
  const variants = {
    'uneven-light': { id: `hard-uneven-${index}`, tiltDegrees: index % 2 ? 1.2 : -1.2 },
    'sensor-noise': { id: `hard-noise-${index}`, exposure: 0.96 + (index % 3) * 0.02 },
    'near-blur': { id: `hard-near-blur-${index}`, tiltDegrees: (index % 3) - 1 },
    'pad-texture': { id: `hard-texture-${index}`, cast: index % 2 ? [1.02, 1, 0.98] : [0.98, 1, 1.02] },
    'background-decoys': { id: `hard-decoys-${index}`, tiltDegrees: index % 2 ? 1.5 : -1.5 },
  };
  const { png } = renderSyntheticStrip(testCase, variants[kind]);
  if (kind === 'uneven-light') return applyUnevenLight(png, index);
  if (kind === 'sensor-noise') return deterministicNoise(png, `${RUN_ID}:noise:${index}`, 13, 4);
  if (kind === 'near-blur') return deterministicNoise(applyBoxBlur(png, 1), `${RUN_ID}:blur:${index}`, 3);
  if (kind === 'pad-texture') return applyPadTexture(png, index);
  if (kind === 'background-decoys') return addBackgroundDecoys(png, index);
  throw new Error(`Unknown hard-valid kind: ${kind}`);
}

function swapPadColors(source, firstIndex, secondIndex) {
  const result = clonePng(source);
  const regions = getFixedPadSampleRegions(result.width, result.height, 4);
  const first = regions[firstIndex];
  const second = regions[secondIndex];
  const left = 32;
  const width = 32;
  const padHeight = 28;
  const firstTop = Math.round(first.y + first.height / 2 - padHeight / 2);
  const secondTop = Math.round(second.y + second.height / 2 - padHeight / 2);
  const firstPixels = [];
  const secondPixels = [];
  for (let y = 0; y < padHeight; y += 1) {
    for (let x = 0; x < width; x += 1) {
      firstPixels.push(getPixel(result, left + x, firstTop + y));
      secondPixels.push(getPixel(result, left + x, secondTop + y));
    }
  }
  let cursor = 0;
  for (let y = 0; y < padHeight; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(result, left + x, firstTop + y, secondPixels[cursor]);
      setPixel(result, left + x, secondTop + y, firstPixels[cursor]);
      cursor += 1;
    }
  }
  return result;
}

function addSecondStrip(source, index) {
  const result = clonePng(source);
  const sourceLeft = 30;
  const sourceWidth = 36;
  const targetLeft = index % 2 ? 2 : 70;
  const targetWidth = 24;
  for (let y = 16; y < result.height - 16; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sampleX = sourceLeft + Math.floor((x / targetWidth) * sourceWidth);
      setPixel(result, targetLeft + x, y, getPixel(source, sampleX, y));
    }
  }
  return result;
}

function buildAdversarialInvalidImage(kind, testCase, index) {
  if (kind === 'three-pads-clean') {
    return renderSyntheticStrip(testCase, { id: `adv-three-${index}`, omitPad: index % 4 }).png;
  }
  const source = renderSyntheticStrip(testCase, { id: `adv-${kind}-${index}` }).png;
  const regions = getFixedPadSampleRegions(source.width, source.height, 4);
  if (kind === 'extra-pad') {
    const result = clonePng(source);
    const region = regions[index % 3];
    const next = regions[(index % 3) + 1];
    const y = Math.round((region.y + region.height + next.y) / 2) - 8;
    drawRect(result, 32, y, 32, 16, [114, 84, 169, 255]);
    return result;
  }
  if (kind === 'two-strips') return addSecondStrip(source, index);
  if (kind === 'colored-decoy-no-body') {
    const result = renderSyntheticStrip(testCase, { id: `adv-decoy-${index}`, hideStrip: true }).png;
    for (let padIndex = 0; padIndex < regions.length; padIndex += 1) {
      const region = regions[padIndex];
      drawRect(result, 32, Math.round(region.y - 5), 32, Math.round(region.height + 10), testCase.padRgbs[padIndex]);
    }
    return result;
  }
  if (kind === 'swapped-order') return swapPadColors(source, index % 3, (index % 3) + 1);
  if (kind === 'partial-occlusion') {
    const result = clonePng(source);
    const region = regions[index % 4];
    drawRect(result, 30, Math.round(region.y - 4), 22, Math.round(region.height + 8), [101, 76, 61, 255]);
    return result;
  }
  if (kind === 'split-pad') {
    const result = clonePng(source);
    const region = regions[index % 4];
    drawRect(result, 30, Math.round(region.y + region.height / 2 - 5), 36, 10, [245, 245, 245, 255]);
    return result;
  }
  if (kind === 'six-pads') {
    const result = clonePng(source);
    drawRect(result, 32, 24, 32, 16, [167, 120, 187, 255]);
    drawRect(result, 32, 246, 32, 16, [83, 126, 91, 255]);
    return result;
  }
  if (kind === 'severe-color-cast') {
    const result = clonePng(source);
    const cast = index % 2 ? [1.35, 0.68, 0.64] : [0.63, 0.78, 1.38];
    for (let offset = 0; offset < result.data.length; offset += 4) {
      for (let channel = 0; channel < 3; channel += 1) {
        result.data[offset + channel] = clampByte(result.data[offset + channel] * cast[channel]);
      }
    }
    return result;
  }
  if (kind === 'cropped-pad') {
    return renderSyntheticStrip(testCase, { id: `adv-crop-${index}`, shiftY: -116 - index * 2 }).png;
  }
  if (kind === 'broken-body') {
    const result = clonePng(source);
    drawRect(result, 27, 130 + index * 3, 42, 15, [18, 87, 110, 255]);
    return result;
  }
  throw new Error(`Unknown adversarial-invalid kind: ${kind}`);
}

function buildInvalidImage(kind, testCase, index) {
  if (kind === 'no-strip') {
    const { png } = renderSyntheticStrip(testCase, {
      id: `invalid-no-strip-${index}`,
      hideStrip: true,
    });
    return varyWholeImage(png, index);
  }
  if (kind === 'missing-pad') {
    const { png } = renderSyntheticStrip(testCase, {
      id: `invalid-missing-pad-${index}`,
      omitPad: index % 4,
      exposure: 0.96 + (index % 3) * 0.025,
    });
    return png;
  }
  if (kind === 'cropped') {
    const { png } = renderSyntheticStrip(testCase, {
      id: `invalid-cropped-${index}`,
      shiftY: -72 - (index % 5) * 8,
      tiltDegrees: (index % 3) - 1,
    });
    return png;
  }
  if (kind === 'too-small') return makeTooSmall(testCase, index);
  if (kind === 'strong-glare') {
    const { png } = renderSyntheticStrip(testCase, { id: `invalid-glare-${index}` });
    return applyStrongGlare(png, index);
  }
  if (kind === 'blurry') {
    const { png } = renderSyntheticStrip(testCase, {
      id: `invalid-blurry-${index}`,
      tiltDegrees: (index % 3) - 1,
    });
    return applyBoxBlur(varyWholeImage(png, index), 4 + (index % 2));
  }
  throw new Error(`Unknown invalid kind: ${kind}`);
}

async function selectBaselineCases() {
  const sourceManifest = JSON.parse(
    await readFile(path.join(sourceDatasetDirectory, 'manifest.json'), 'utf8'),
  );
  let previousIds = new Set();
  try {
    const previousReport = JSON.parse(await readFile(previousReportPath, 'utf8'));
    previousIds = new Set((previousReport.results ?? []).map((result) => result.fixtureId));
  } catch {
    // The exclusion report is optional outside this repository.
  }

  const validCases = [];
  for (const variant of VALID_VARIANTS) {
    const candidates = sourceManifest.fixtures
      .filter(
        (fixture) =>
          fixture.valid && fixture.variant === variant && !previousIds.has(fixture.id),
      )
      .sort(
        (left, right) =>
          seededRank(left.id, `valid-${variant}`) - seededRank(right.id, `valid-${variant}`),
      );
    if (candidates.length < VALID_PER_VARIANT) {
      throw new Error(`Only ${candidates.length} unused valid fixtures found for ${variant}.`);
    }
    validCases.push(
      ...candidates.slice(0, VALID_PER_VARIANT).map((fixture) => ({
        ...fixture,
        expectedAccepted: true,
        imagePath: path.join(sourceDatasetDirectory, fixture.relativePath),
      })),
    );
  }

  const canonicalCases = enumerateCanonicalCases().sort(
    (left, right) => seededRank(left.id, 'invalid-source') - seededRank(right.id, 'invalid-source'),
  );
  const invalidDefinitions = [
    { kind: 'no-strip', expectedFailureFamily: ['not_strip'] },
    { kind: 'missing-pad', expectedFailureFamily: ['framing'] },
    { kind: 'cropped', expectedFailureFamily: ['framing'] },
    { kind: 'too-small', expectedFailureFamily: ['framing'] },
    { kind: 'strong-glare', expectedFailureFamily: ['lighting', 'low_confidence'] },
    { kind: 'blurry', expectedFailureFamily: ['blurry', 'low_confidence'] },
  ];
  const invalidCases = [];
  const invalidContactEntries = [];
  for (let kindIndex = 0; kindIndex < invalidDefinitions.length; kindIndex += 1) {
    const definition = invalidDefinitions[kindIndex];
    for (let index = 0; index < INVALID_PER_VARIANT; index += 1) {
      const sourceCase = canonicalCases[kindIndex * INVALID_PER_VARIANT + index];
      const png = buildInvalidImage(definition.kind, sourceCase, index);
      const fixtureId = `invalid-${definition.kind}-${String(index + 1).padStart(2, '0')}-${sourceCase.id}`;
      const relativePath = path.posix.join('invalid', `${fixtureId}.png`);
      const imagePath = path.join(runDirectory, relativePath);
      await writeFile(imagePath, writePng(png));
      invalidCases.push({
        id: fixtureId,
        relativePath,
        imagePath,
        valid: false,
        tier: 'invalid',
        variant: definition.kind,
        expectedAccepted: false,
        expectedFailureFamily: definition.expectedFailureFamily,
      });
      invalidContactEntries.push({ png });
    }
  }

  const selected = [...validCases, ...invalidCases].map((fixture, index) => ({
    ...fixture,
    index: index + 1,
  }));
  const selectedIds = new Set(selected.map((fixture) => fixture.id));
  if (selected.length !== 200 || selectedIds.size !== 200) {
    throw new Error(`Expected 200 unique fixtures, got ${selected.length}/${selectedIds.size}.`);
  }
  if (selected.some((fixture) => previousIds.has(fixture.id))) {
    throw new Error('The selected set overlaps the prior 20-fixture run.');
  }

  await writeFile(
    selectedManifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        runId: RUN_ID,
        generatedAt: new Date().toISOString(),
        previousFixtureIdsExcluded: [...previousIds],
        validCount: validCases.length,
        invalidCount: invalidCases.length,
        fixtures: selected.map(({ imagePath, ...fixture }) => fixture),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    path.join(runDirectory, 'contact-sheet-invalid.png'),
    writePng(buildContactSheet(invalidContactEntries, 6)),
  );

  const sampleEntries = [];
  for (const fixture of validCases.filter((_, index) => index % 7 === 0).slice(0, 20)) {
    sampleEntries.push({ png: PNG.sync.read(await readFile(fixture.imagePath)) });
  }
  sampleEntries.push(...invalidContactEntries.filter((_, index) => index % 3 === 0).slice(0, 20));
  await writeFile(
    path.join(runDirectory, 'contact-sheet-sample.png'),
    writePng(buildContactSheet(sampleEntries, 8)),
  );

  return selected;
}

async function selectCases() {
  const canonicalCases = enumerateCanonicalCases().sort(
    (left, right) => seededRank(left.id, 'adversarial-source') - seededRank(right.id, 'adversarial-source'),
  );
  const validDefinitions = [
    'uneven-light',
    'sensor-noise',
    'near-blur',
    'pad-texture',
    'background-decoys',
  ];
  const invalidDefinitions = [
    { kind: 'three-pads-clean', expectedFailureFamily: ['framing'] },
    { kind: 'extra-pad', expectedFailureFamily: ['framing', 'wrong_brand'] },
    { kind: 'two-strips', expectedFailureFamily: ['framing', 'not_strip'] },
    { kind: 'colored-decoy-no-body', expectedFailureFamily: ['not_strip', 'wrong_brand'] },
    { kind: 'swapped-order', expectedFailureFamily: ['wrong_brand', 'low_confidence'] },
    { kind: 'partial-occlusion', expectedFailureFamily: ['framing', 'low_confidence'] },
    { kind: 'split-pad', expectedFailureFamily: ['framing', 'wrong_brand'] },
    { kind: 'six-pads', expectedFailureFamily: ['framing', 'wrong_brand'] },
    { kind: 'severe-color-cast', expectedFailureFamily: ['lighting', 'low_confidence'] },
    { kind: 'cropped-pad', expectedFailureFamily: ['framing'] },
  ];
  const validCases = [];
  const invalidCases = [];
  const validContactEntries = [];
  const invalidContactEntries = [];
  let sourceCursor = 0;

  for (const kind of validDefinitions) {
    for (let index = 0; index < VALID_PER_VARIANT; index += 1) {
      const sourceCase = canonicalCases[sourceCursor];
      sourceCursor += 1;
      const fixtureId = `hard-valid-${kind}-${String(index + 1).padStart(2, '0')}-${sourceCase.id}`;
      const relativePath = path.posix.join('valid', `${fixtureId}.png`);
      const imagePath = path.join(runDirectory, relativePath);
      const png = buildHardValidImage(kind, sourceCase, index);
      await writeFile(imagePath, writePng(png));
      validCases.push({
        id: fixtureId,
        relativePath,
        imagePath,
        valid: true,
        tier: 'adversarial-valid',
        variant: kind,
        expectedAccepted: true,
        expected: sourceCase.expected,
      });
      validContactEntries.push({ png });
    }
  }

  for (const definition of invalidDefinitions) {
    for (let index = 0; index < INVALID_PER_VARIANT; index += 1) {
      const sourceCase = canonicalCases[sourceCursor];
      sourceCursor += 1;
      const fixtureId = `hard-invalid-${definition.kind}-${String(index + 1).padStart(2, '0')}-${sourceCase.id}`;
      const relativePath = path.posix.join('invalid', `${fixtureId}.png`);
      const imagePath = path.join(runDirectory, relativePath);
      const png = buildAdversarialInvalidImage(definition.kind, sourceCase, index);
      await writeFile(imagePath, writePng(png));
      invalidCases.push({
        id: fixtureId,
        relativePath,
        imagePath,
        valid: false,
        tier: 'adversarial-invalid',
        variant: definition.kind,
        expectedAccepted: false,
        expectedFailureFamily: definition.expectedFailureFamily,
      });
      invalidContactEntries.push({ png });
    }
  }

  const selected = [...validCases, ...invalidCases].map((fixture, index) => ({
    ...fixture,
    index: index + 1,
  }));
  const uniqueIds = new Set(selected.map((fixture) => fixture.id));
  if (selected.length !== TOTAL_FIXTURES || uniqueIds.size !== TOTAL_FIXTURES) {
    throw new Error(`Expected ${TOTAL_FIXTURES} unique fixtures, got ${selected.length}/${uniqueIds.size}.`);
  }

  await writeFile(
    selectedManifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        runId: RUN_ID,
        generatedAt: new Date().toISOString(),
        seed: RUN_ID,
        purpose: 'Randomized adversarial production evaluation against Gemini quality gate',
        validCount: validCases.length,
        invalidCount: invalidCases.length,
        fixtures: selected.map(({ imagePath, ...fixture }) => fixture),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    path.join(runDirectory, 'contact-sheet-valid.png'),
    writePng(buildContactSheet(validContactEntries, 10)),
  );
  await writeFile(
    path.join(runDirectory, 'contact-sheet-invalid.png'),
    writePng(buildContactSheet(invalidContactEntries, 10)),
  );
  await writeFile(
    path.join(runDirectory, 'contact-sheet-sample.png'),
    writePng(
      buildContactSheet(
        [
          ...validContactEntries.filter((_, index) => index % 5 === 0),
          ...invalidContactEntries.filter((_, index) => index % 5 === 0),
        ],
        10,
      ),
    ),
  );
  return selected;
}

function parseActual(payload) {
  return Object.fromEntries(
    (payload.result?.parameters ?? []).map((parameter) => [parameter.key, parameter.value]),
  );
}

async function callProduction(fixture) {
  const imageBuffer = await readFile(fixture.imagePath);
  const base64 = imageBuffer.toString('base64');
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testId: `${RUN_ID}-${String(fixture.index).padStart(3, '0')}`,
          brandId: 'aquachek-pro',
          imageUri: `data:image/png;base64,${base64}`,
          metadata: {
            synthetic: true,
            fixtureId: fixture.id,
            expectedAccepted: fixture.expectedAccepted,
            e2eRunId: RUN_ID,
          },
        }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (response.status === 404 && payload.message === 'Requested function was not found') {
        const error = new Error(`Production function not found at ${ENDPOINT}`);
        error.nonRetryable = true;
        throw error;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        lastError = new Error(`HTTP ${response.status}: ${payload.message ?? payload.code ?? 'retryable error'}`);
      } else {
        const actual = parseActual(payload);
        const matches = fixture.expected
          ? Object.fromEntries(PARAMS.map((key) => [key, actual[key] === fixture.expected[key]]))
          : {};
        const accepted = payload.result?.accepted === true;
        const failureReason = payload.result?.failureReason ?? payload.code ?? null;
        return {
          index: fixture.index,
          fixtureId: fixture.id,
          relativePath: fixture.relativePath,
          tier: fixture.tier,
          variant: fixture.variant,
          expectedAccepted: fixture.expectedAccepted,
          expectedFailureFamily: fixture.expectedFailureFamily,
          expected: fixture.expected,
          httpStatus: response.status,
          ok: payload.ok === true,
          accepted,
          acceptanceCorrect: accepted === fixture.expectedAccepted,
          isValidStrip: payload.result?.isValidStrip === true,
          confidence: payload.result?.confidence ?? null,
          model: payload.result?.model ?? null,
          analysisVersion: payload.result?.analysisVersion ?? null,
          actual,
          matches,
          exactMatch:
            fixture.expectedAccepted && PARAMS.every((key) => matches[key] === true),
          failureReason,
          failureFamilyMatch:
            !fixture.expectedAccepted && fixture.expectedFailureFamily?.includes(failureReason),
          notes: payload.result?.notes ?? payload.message ?? null,
          consensus: payload.result?.consensus ?? null,
          elapsedMs: Date.now() - startedAt,
          attempt,
        };
      }
    } catch (error) {
      lastError = error;
      if (error?.nonRetryable || attempt >= 3) break;
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500 * attempt));
  }

  return {
    index: fixture.index,
    fixtureId: fixture.id,
    relativePath: fixture.relativePath,
    tier: fixture.tier,
    variant: fixture.variant,
    expectedAccepted: fixture.expectedAccepted,
    expectedFailureFamily: fixture.expectedFailureFamily,
    expected: fixture.expected,
    ok: false,
    accepted: false,
    acceptanceCorrect: fixture.expectedAccepted === false,
    exactMatch: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function summarize(results) {
  const valid = results.filter((result) => result.expectedAccepted);
  const invalid = results.filter((result) => !result.expectedAccepted);
  const validAccepted = valid.filter((result) => result.accepted).length;
  const invalidRejected = invalid.filter((result) => !result.accepted && !result.error).length;
  const exactMatches = valid.filter((result) => result.exactMatch).length;
  const requestErrors = results.filter((result) => result.error).length;
  const parameterAccuracy = Object.fromEntries(
    PARAMS.map((key) => {
      const compared = valid.filter((result) => result.actual && key in result.actual);
      const correct = compared.filter((result) => result.matches?.[key]).length;
      return [
        key,
        {
          correct,
          compared: compared.length,
          accuracy: compared.length ? correct / compared.length : 0,
        },
      ];
    }),
  );
  const variants = {};
  for (const result of results) {
    const entry = variants[result.variant] ?? {
      count: 0,
      accepted: 0,
      rejected: 0,
      exactMatches: 0,
      requestErrors: 0,
      failureReasons: {},
    };
    entry.count += 1;
    if (result.accepted) entry.accepted += 1;
    else entry.rejected += 1;
    if (result.exactMatch) entry.exactMatches += 1;
    if (result.error) entry.requestErrors += 1;
    if (result.failureReason) {
      entry.failureReasons[result.failureReason] =
        (entry.failureReasons[result.failureReason] ?? 0) + 1;
    }
    variants[result.variant] = entry;
  }
  const elapsed = results.map((result) => result.elapsedMs).filter(Number.isFinite);
  const models = [...new Set(results.map((result) => result.model).filter(Boolean))];
  const analysisVersions = [
    ...new Set(results.map((result) => result.analysisVersion).filter(Boolean)),
  ];
  return {
    completed: results.length,
    requestErrors,
    valid: {
      count: valid.length,
      accepted: validAccepted,
      rejected: valid.length - validAccepted,
      acceptanceRate: valid.length ? validAccepted / valid.length : 0,
      exactMatches,
      exactMatchRate: valid.length ? exactMatches / valid.length : 0,
    },
    invalid: {
      count: invalid.length,
      rejected: invalidRejected,
      falseAccepted: invalid.filter((result) => result.accepted).length,
      rejectionRate: invalid.length ? invalidRejected / invalid.length : 0,
    },
    balancedAccuracy:
      valid.length && invalid.length
        ? (validAccepted / valid.length + invalidRejected / invalid.length) / 2
        : 0,
    parameterAccuracy,
    variants,
    models,
    expectedModel: EXPECTED_MODEL,
    expectedModelOnly: models.length === 1 && models[0] === EXPECTED_MODEL,
    analysisVersions,
    latencyMs: {
      p50: percentile(elapsed, 0.5),
      p95: percentile(elapsed, 0.95),
      max: elapsed.length ? Math.max(...elapsed) : null,
    },
  };
}

function pct(value) {
  return `${(value * 100).toFixed(2)}%`;
}

async function saveReport(results) {
  const orderedResults = [...results].sort((left, right) => left.index - right.index);
  const summary = summarize(orderedResults);
  const report = {
    generatedAt: new Date().toISOString(),
    runId: RUN_ID,
    endpoint: ENDPOINT,
    requestedFixtures: TOTAL_FIXTURES,
    concurrency: CONCURRENCY,
    summary,
    results: orderedResults,
  };
  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const variantRows = Object.entries(summary.variants).map(([variant, values]) => {
    const expectedOutcome = orderedResults.some(
      (result) => result.variant === variant && result.expectedAccepted,
    )
      ? 'accept + exact'
      : 'reject';
    return `| ${variant} | ${expectedOutcome} | ${values.count} | ${values.accepted} | ${values.rejected} | ${values.exactMatches} | ${values.requestErrors} | ${Object.entries(values.failureReasons).map(([reason, count]) => `${reason}: ${count}`).join(', ') || '-'} |`;
  });
  const parameterRows = PARAMS.map((key) => {
    const values = summary.parameterAccuracy[key];
    return `| ${key} | ${values.correct}/${values.compared} | ${pct(values.accuracy)} |`;
  });
  const failures = orderedResults.filter(
    (result) => !result.acceptanceCorrect || (result.expectedAccepted && !result.exactMatch) || result.error,
  );
  const failureRows = failures.map(
    (result) =>
      `| ${result.index} | ${result.variant} | ${result.fixtureId} | ${result.expectedAccepted ? 'accept' : 'reject'} | ${result.accepted ? 'accepted' : 'rejected'} | ${result.exactMatch ? 'yes' : 'no'} | ${result.failureReason ?? result.error ?? '-'} |`,
  );
  const markdown = [
    `# AquaChek production adversarial evaluation: ${TOTAL_FIXTURES} randomized hard fixtures`,
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `- Model(s): ${summary.models.join(', ') || 'none'}${summary.expectedModelOnly ? ' (expected)' : ' (unexpected)'}`,
    `- Analysis version(s): ${summary.analysisVersions.join(', ') || 'none'}`,
    `- Valid acceptance: ${summary.valid.accepted}/${summary.valid.count} (${pct(summary.valid.acceptanceRate)})`,
    `- Valid exact full-strip match: ${summary.valid.exactMatches}/${summary.valid.count} (${pct(summary.valid.exactMatchRate)})`,
    `- Invalid rejection: ${summary.invalid.rejected}/${summary.invalid.count} (${pct(summary.invalid.rejectionRate)})`,
    `- Invalid false accepts: ${summary.invalid.falseAccepted}`,
    `- Balanced accuracy: ${pct(summary.balancedAccuracy)}`,
    `- Request errors: ${summary.requestErrors}`,
    `- Latency p50 / p95 / max: ${summary.latencyMs.p50 ?? '-'} / ${summary.latencyMs.p95 ?? '-'} / ${summary.latencyMs.max ?? '-'} ms`,
    '',
    '## Parameter accuracy on valid fixtures',
    '',
    '| Parameter | Correct | Accuracy |',
    '|---|---:|---:|',
    ...parameterRows,
    '',
    '## Variant results',
    '',
    '| Variant | Expected | Count | Accepted | Rejected | Exact | Errors | Failure reasons |',
    '|---|---|---:|---:|---:|---:|---:|---|',
    ...variantRows,
    '',
    '## Incorrect or failed cases',
    '',
    '| # | Variant | Fixture | Expected | Actual | Exact | Reason |',
    '|---:|---|---|---|---|---|---|',
    ...(failureRows.length ? failureRows : ['| - | - | None | - | - | - | - |']),
    '',
  ].join('\n');
  await writeFile(reportMarkdownPath, markdown, 'utf8');
  return report;
}

async function loadCheckpoint() {
  if (RESET) return [];
  try {
    const content = await readFile(checkpointPath, 'utf8');
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

await mkdir(validDirectory, { recursive: true });
await mkdir(invalidDirectory, { recursive: true });
if (RESET) {
  await rm(runDirectory, { recursive: true, force: true });
  await mkdir(validDirectory, { recursive: true });
  await mkdir(invalidDirectory, { recursive: true });
}

const selected = await selectCases();
if (PREPARE_ONLY) {
  console.log(
    JSON.stringify(
      {
        prepared: selected.length,
        valid: selected.filter((fixture) => fixture.expectedAccepted).length,
        invalid: selected.filter((fixture) => !fixture.expectedAccepted).length,
        selectedManifestPath,
        invalidContactSheet: path.join(runDirectory, 'contact-sheet-invalid.png'),
        sampleContactSheet: path.join(runDirectory, 'contact-sheet-sample.png'),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (SMOKE_ONLY) {
  const smokeFixtures = [
    selected.find((fixture) => fixture.expectedAccepted),
    selected.find((fixture) => !fixture.expectedAccepted),
  ].filter(Boolean);
  const smokeResults = [];
  for (const fixture of smokeFixtures) {
    const result = await callProduction(fixture);
    smokeResults.push(result);
    if (result.error) throw new Error(`Smoke test failed: ${result.error}`);
    if (result.model !== EXPECTED_MODEL || !result.analysisVersion) {
      throw new Error(
        `Smoke test did not reach ${EXPECTED_MODEL}: ${JSON.stringify({
          status: result.httpStatus,
          model: result.model,
          analysisVersion: result.analysisVersion,
          failureReason: result.failureReason,
          notes: result.notes,
        })}`,
      );
    }
  }
  console.log(
    JSON.stringify(
      smokeResults.map((result) => ({
        variant: result.variant,
        expectedAccepted: result.expectedAccepted,
        accepted: result.accepted,
        exactMatch: result.exactMatch,
        failureReason: result.failureReason,
        model: result.model,
        analysisVersion: result.analysisVersion,
        elapsedMs: result.elapsedMs,
      })),
      null,
      2,
    ),
  );
  process.exit(0);
}
const existingResults = await loadCheckpoint();
const completedIds = new Set(existingResults.map((result) => result.fixtureId));
const pending = selected.filter((fixture) => !completedIds.has(fixture.id));
const results = [...existingResults];

console.log(
  `Prepared ${selected.length} randomized adversarial fixtures (${selected.filter((fixture) => fixture.expectedAccepted).length} valid, ${selected.filter((fixture) => !fixture.expectedAccepted).length} invalid); ${pending.length} pending.`,
);

let nextPendingIndex = 0;
async function worker(workerId) {
  while (nextPendingIndex < pending.length) {
    const current = pending[nextPendingIndex];
    nextPendingIndex += 1;
    const record = await callProduction(current);
    results.push(record);
    await writeFile(checkpointPath, `${JSON.stringify(record)}\n`, { encoding: 'utf8', flag: 'a' });
    const completed = results.length;
    const outcome = record.error
      ? `error=${record.error}`
      : `accepted=${record.accepted} exact=${record.exactMatch} reason=${record.failureReason ?? 'none'}`;
    console.log(`[${completed}/${TOTAL_FIXTURES}] worker=${workerId} ${record.variant} ${outcome}`);
    if (completed % 10 === 0 || completed === TOTAL_FIXTURES) await saveReport(results);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, index) => worker(index + 1)));
const finalReport = await saveReport(results);

console.log(
  JSON.stringify(
    {
      reportJsonPath,
      reportMarkdownPath,
      selectedManifestPath,
      invalidContactSheet: path.join(runDirectory, 'contact-sheet-invalid.png'),
      sampleContactSheet: path.join(runDirectory, 'contact-sheet-sample.png'),
      summary: finalReport.summary,
    },
    null,
    2,
  ),
);
