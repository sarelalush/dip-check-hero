import { AQUACHEK_PRO_REFS } from './aquachek-pro-reference.js';

const PRIMARY_PARAMETERS = [
  'totalChlorine',
  'freeChlorine',
  'ph',
  'alkalinity',
];

function snapToLevel(value, levels) {
  if (!Number.isFinite(value) || levels.length === 0) return undefined;

  return levels.reduce((nearest, level) =>
    Math.abs(level - value) < Math.abs(nearest - value) ? level : nearest,
  levels[0]);
}

function mostCommonValue(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? [undefined, 0];
}

function levelsFor(parameter) {
  return (AQUACHEK_PRO_REFS[parameter] ?? []).map((reference) => reference.value);
}

export function selectAquachekProAiConsensus(readings, requiredAgreement = 2) {
  const values = {};
  const parameters = {};
  const missingConsensus = [];

  for (const parameter of PRIMARY_PARAMETERS) {
    const chartValues = levelsFor(parameter);
    const rawValues = readings
      .map((reading) => reading?.[parameter])
      .filter((value) => Number.isFinite(value));
    const snappedValues = rawValues
      .map((value) => snapToLevel(value, chartValues))
      .filter((value) => Number.isFinite(value));
    const [selectedValue, agreementCount] = mostCommonValue(snappedValues);

    parameters[parameter] = {
      chartValues,
      rawValues,
      snappedValues,
      selectedValue,
      agreementCount,
      requiredAgreement,
    };

    if (!Number.isFinite(selectedValue) || agreementCount < requiredAgreement) {
      missingConsensus.push(parameter);
      continue;
    }

    values[parameter] = selectedValue;
  }

  if (Number.isFinite(values.totalChlorine)) {
    const totalChlorineLevels = levelsFor('totalChlorine');
    const bromineLevels = levelsFor('bromine');
    const combinedPadIndex = totalChlorineLevels.indexOf(values.totalChlorine);
    const bromineValue = combinedPadIndex >= 0 ? bromineLevels[combinedPadIndex] : undefined;
    const rawValues = readings
      .map((reading) => reading?.totalChlorine)
      .filter((value) => Number.isFinite(value));
    const snappedValues = rawValues
      .map((value) => snapToLevel(value, totalChlorineLevels))
      .map((value) => bromineLevels[totalChlorineLevels.indexOf(value)])
      .filter((value) => Number.isFinite(value));

    parameters.bromine = {
      chartValues: bromineLevels,
      rawValues,
      snappedValues,
      selectedValue: bromineValue,
      agreementCount: parameters.totalChlorine.agreementCount,
      requiredAgreement,
    };
    values.bromine = bromineValue;
  } else {
    parameters.bromine = {
      chartValues: levelsFor('bromine'),
      rawValues: [],
      snappedValues: [],
      selectedValue: undefined,
      agreementCount: 0,
      requiredAgreement,
    };
  }

  return {
    accepted: missingConsensus.length === 0 && Number.isFinite(values.bromine),
    values,
    parameters,
    missingConsensus,
  };
}
