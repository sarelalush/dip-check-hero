import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  VALID_VARIANTS,
  buildContactSheet,
  buildInvalidFixtures,
  enumerateCanonicalCases,
  renderSyntheticStrip,
  selectStressCases,
  writePng,
} from './fixture-utils.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');
const outputDirectory = path.join(repositoryRoot, 'work/aquachek-synthetic-dataset');

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const cases = enumerateCanonicalCases();
const stressCases = selectStressCases(cases);
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  stripModel: 'AquaChek Pro 5-in-1',
  padOrder: ['totalChlorineAndBromine', 'freeChlorine', 'ph', 'alkalinity'],
  canonicalCombinationCount: cases.length,
  variants: VALID_VARIANTS,
  fixtures: [],
};

const contactEntries = [];
const invalidContactEntries = [];
for (const variant of VALID_VARIANTS) {
  const variantCases = variant.id === 'canonical' ? cases : stressCases;
  const variantDirectory = path.join(outputDirectory, variant.id);
  await mkdir(variantDirectory, { recursive: true });
  for (let index = 0; index < variantCases.length; index += 1) {
    const testCase = variantCases[index];
    const { png, transformedPads } = renderSyntheticStrip(testCase, variant);
    const relativePath = path.posix.join(variant.id, `${testCase.id}.png`);
    await writeFile(path.join(outputDirectory, relativePath), writePng(png));
    manifest.fixtures.push({
      id: `${variant.id}_${testCase.id}`,
      relativePath,
      valid: true,
      tier: variant.tier,
      variant: variant.id,
      expected: testCase.expected,
      sourcePadRgbs: testCase.padRgbs,
      renderedPadRgbs: transformedPads,
    });
    if (index % Math.max(1, Math.floor(variantCases.length / 5)) === 0) contactEntries.push({ png });
  }
}

const invalidDirectory = path.join(outputDirectory, 'invalid');
await mkdir(invalidDirectory, { recursive: true });
for (const invalidFixture of buildInvalidFixtures(cases[Math.floor(cases.length / 2)])) {
  const { png } = renderSyntheticStrip(invalidFixture.sourceCase, invalidFixture.variant);
  const relativePath = path.posix.join('invalid', `${invalidFixture.id}.png`);
  await writeFile(path.join(outputDirectory, relativePath), writePng(png));
  manifest.fixtures.push({
    id: invalidFixture.id,
    relativePath,
    valid: false,
    tier: invalidFixture.tier,
    variant: invalidFixture.variant.id,
    expectedFailureReason: invalidFixture.expectedFailureReason,
  });
  invalidContactEntries.push({ png });
}

const csvHeader = [
  'id',
  'total_chlorine_ppm',
  'total_bromine_ppm',
  'free_chlorine_ppm',
  'ph',
  'total_alkalinity_ppm',
  'combined_pad_rgb',
  'free_chlorine_pad_rgb',
  'ph_pad_rgb',
  'alkalinity_pad_rgb',
];
const csvRows = cases.map((testCase) => [
  testCase.id,
  testCase.expected.totalChlorine,
  testCase.expected.bromine,
  testCase.expected.freeChlorine,
  testCase.expected.ph,
  testCase.expected.alkalinity,
  ...testCase.padRgbs.map((rgb) => rgb.join('-')),
]);

await writeFile(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);
await writeFile(
  path.join(outputDirectory, 'canonical-states.csv'),
  `${[csvHeader, ...csvRows].map((row) => row.join(',')).join('\n')}\n`,
  'utf8',
);
await writeFile(
  path.join(outputDirectory, 'contact-sheet-valid.png'),
  writePng(buildContactSheet(contactEntries.slice(0, 25))),
);
await writeFile(
  path.join(outputDirectory, 'contact-sheet-invalid.png'),
  writePng(buildContactSheet(invalidContactEntries)),
);
await writeFile(
  path.join(outputDirectory, 'contact-sheet.png'),
  writePng(buildContactSheet([...contactEntries.slice(0, 19), ...invalidContactEntries])),
);

console.log(
  `Generated ${manifest.fixtures.length} fixtures (${cases.length} complete canonical combinations, ${stressCases.length} cases per stress variant, and ${manifest.fixtures.filter((fixture) => !fixture.valid).length} invalid) in ${outputDirectory}`,
);
