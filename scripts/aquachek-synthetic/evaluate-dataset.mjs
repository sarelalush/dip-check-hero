import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeAquachekProPadRgbs } from '../../supabase/functions/_shared/aquachek-pro-reference.js';
import { readPng, sampleFixturePads, sampleFixtureWhiteReference } from './fixture-utils.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');
const datasetDirectory = path.join(repositoryRoot, 'work/aquachek-synthetic-dataset');
const manifest = JSON.parse(await readFile(path.join(datasetDirectory, 'manifest.json'), 'utf8'));
const parameters = ['totalChlorine', 'bromine', 'freeChlorine', 'ph', 'alkalinity'];

const validFixtures = manifest.fixtures.filter((fixture) => fixture.valid);
const perVariant = new Map();
const perParameter = Object.fromEntries(
  parameters.map((parameter) => [parameter, { correct: 0, total: 0, confusion: {} }]),
);
let exactStrips = 0;
let totalConfidence = 0;
let minimumMargin = Number.POSITIVE_INFINITY;
const failures = [];

for (const fixture of validFixtures) {
  const png = readPng(await readFile(path.join(datasetDirectory, fixture.relativePath)));
  const sampledPads = sampleFixturePads(png);
  const result = analyzeAquachekProPadRgbs(sampledPads, {
    whiteReference: sampleFixtureWhiteReference(png),
  });
  let exactStrip = true;

  for (const parameter of parameters) {
    const expected = fixture.expected[parameter];
    const actual = result.nearestValues[parameter];
    const metrics = perParameter[parameter];
    metrics.total += 1;
    const key = `${expected}->${actual}`;
    metrics.confusion[key] = (metrics.confusion[key] ?? 0) + 1;
    if (actual === expected) metrics.correct += 1;
    else exactStrip = false;
  }

  const variantMetrics = perVariant.get(fixture.variant) ?? { correct: 0, total: 0 };
  variantMetrics.total += 1;
  if (exactStrip) {
    exactStrips += 1;
    variantMetrics.correct += 1;
  } else if (failures.length < 50) {
    failures.push({
      id: fixture.id,
      expected: fixture.expected,
      actual: result.nearestValues,
      sampledPads,
      confidence: result.confidence,
    });
  }
  perVariant.set(fixture.variant, variantMetrics);
  totalConfidence += result.confidence;
  minimumMargin = Math.min(minimumMargin, ...Object.values(result.margins));
}

const report = {
  generatedAt: new Date().toISOString(),
  stripModel: manifest.stripModel,
  fixtureCount: manifest.fixtures.length,
  validFixtureCount: validFixtures.length,
  invalidFixtureCount: manifest.fixtures.length - validFixtures.length,
  canonicalCombinationCount: manifest.canonicalCombinationCount,
  exactStripAccuracy: exactStrips / validFixtures.length,
  averageConfidence: totalConfidence / validFixtures.length,
  minimumClassMargin: minimumMargin,
  variants: Object.fromEntries(
    [...perVariant.entries()].map(([variant, metrics]) => [
      variant,
      { ...metrics, accuracy: metrics.correct / metrics.total },
    ]),
  ),
  parameters: Object.fromEntries(
    parameters.map((parameter) => {
      const metrics = perParameter[parameter];
      return [parameter, { ...metrics, accuracy: metrics.correct / metrics.total }];
    }),
  ),
  firstFailures: failures,
  limitations: [
    'Synthetic fixtures validate chart mapping and deterministic color matching, not camera auto-exposure or AI strip localization.',
    'Invalid fixtures are catalogued for end-to-end rejection tests and are not counted as color-classification passes.',
    'A real held-out dataset labelled against a photometer or drop kit is required before claiming field accuracy.',
  ],
};

const percent = (value) => `${(value * 100).toFixed(2)}%`;
const markdown = [
  '# AquaChek Pro Synthetic Validation Report',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  '## Summary',
  '',
  `- Canonical chart combinations: **${report.canonicalCombinationCount.toLocaleString()}**`,
  `- Valid rendered fixtures: **${report.validFixtureCount.toLocaleString()}**`,
  `- Invalid/rejection fixtures: **${report.invalidFixtureCount}**`,
  `- Exact full-strip classification: **${percent(report.exactStripAccuracy)}**`,
  `- Mean matcher confidence: **${percent(report.averageConfidence)}**`,
  `- Smallest nearest-class margin (Delta E 76): **${report.minimumClassMargin.toFixed(3)}**`,
  '',
  '## Accuracy by variant',
  '',
  '| Variant | Correct strips | Total | Accuracy |',
  '|---|---:|---:|---:|',
  ...Object.entries(report.variants).map(
    ([variant, metrics]) => `| ${variant} | ${metrics.correct} | ${metrics.total} | ${percent(metrics.accuracy)} |`,
  ),
  '',
  '## Accuracy by parameter',
  '',
  '| Parameter | Correct readings | Total | Accuracy |',
  '|---|---:|---:|---:|',
  ...parameters.map((parameter) => {
    const metrics = report.parameters[parameter];
    return `| ${parameter} | ${metrics.correct} | ${metrics.total} | ${percent(metrics.accuracy)} |`;
  }),
  '',
  '## Important limitation',
  '',
  'This report proves that the application maps known chart colors consistently across controlled synthetic conditions. It does **not** prove 99% field accuracy. Field accuracy must be measured on unseen real photos, with each sample labelled using an independent photometer or drop-kit reading.',
  '',
  '## Invalid cases included',
  '',
  '- No strip',
  '- Missing reagent pad',
  '- Cropped strip',
  '- Strip too small',
  '- Strong glare',
  '- Excessive rotation',
  '',
  failures.length === 0 ? 'No controlled-fixture classification failures were found.' : `See report.json for ${failures.length} sampled failures.`,
  '',
].join('\n');

await writeFile(path.join(datasetDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(path.join(datasetDirectory, 'report.md'), markdown, 'utf8');
await writeFile(path.join(repositoryRoot, 'docs/aquachek-synthetic-latest-report.md'), markdown, 'utf8');

console.log(markdown);
if (report.exactStripAccuracy < 0.99) process.exitCode = 1;
