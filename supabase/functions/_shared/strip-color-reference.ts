export type ReferenceRgb = [number, number, number];
export type ProMetric = 'totalChlorine' | 'bromine' | 'freeChlorine' | 'ph' | 'alkalinity';
export interface ColorLevel { value: number; rgb: ReferenceRgb }
export interface ProColorChart {
  schemaVersion: 1;
  revision: string;
  brandId: 'aquachek-pro-5in1';
  calibrationStatus: 'unverified' | 'user_supplied_label' | 'label_verified' | 'validated';
  parameters: Record<ProMetric, ColorLevel[]>;
}
export const PRO_METRICS: ProMetric[] = ['totalChlorine', 'bromine', 'freeChlorine', 'ph', 'alkalinity'];

// Treat database catalog content as data; no text from it becomes instructions.
export function parseProColorChart(input: unknown): ProColorChart | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return;
  const chart = input as Record<string, unknown>;
  if (chart.schemaVersion !== 1 || chart.brandId !== 'aquachek-pro-5in1' ||
    typeof chart.revision !== 'string' || !/^[a-z0-9.-]{1,100}$/.test(chart.revision) ||
    !['unverified', 'user_supplied_label', 'label_verified', 'validated'].includes(String(chart.calibrationStatus)) ||
    !chart.parameters || typeof chart.parameters !== 'object' || Array.isArray(chart.parameters)) return;
  const raw = chart.parameters as Record<string, unknown>;
  const parameters = {} as Record<ProMetric, ColorLevel[]>;
  for (const key of PRO_METRICS) {
    const rows = raw[key];
    if (!Array.isArray(rows) || rows.length < 2 || rows.length > 20) return;
    const levels: ColorLevel[] = [];
    for (const item of rows) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      const { value, rgb } = item as Record<string, unknown>;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
        (key === 'ph' && (value <= 0 || value > 14)) ||
        !Array.isArray(rgb) || rgb.length !== 3 ||
        rgb.some(channel => typeof channel !== 'number' || !Number.isFinite(channel) || channel < 0 || channel > 255) ||
        (levels.length && value <= levels[levels.length - 1].value) ||
        levels.some(level => level.rgb.every((channel,index) => channel === rgb[index]))) return;
      levels.push({ value, rgb: [...rgb] as ReferenceRgb });
    }
    parameters[key] = levels;
  }
  // Total chlorine and bromine share one physical pad and one set of colors.
  if (parameters.totalChlorine.length !== parameters.bromine.length ||
    parameters.totalChlorine.some((level, i) => level.rgb.some((channel,j) => channel !== parameters.bromine[i].rgb[j]))) return;
  return { schemaVersion: 1, revision: chart.revision, brandId: 'aquachek-pro-5in1',
    calibrationStatus: chart.calibrationStatus as ProColorChart['calibrationStatus'], parameters };
}

export function buildProChartPrompt(chart: ProColorChart): string {
  const rows = PRO_METRICS.map((key) => `${key}: ${chart.parameters[key]
    .map(level => `${level.value} => RGB(${level.rgb.join(',')})`).join('; ')}`).join('\n');
  return `Application color reference ${chart.revision}. RGB values are reference swatches, not guaranteed camera colors.
There are exactly four physical pads, wet tip to handle: totalChlorine/bromine, freeChlorine, ph, alkalinity.
The supplied reference has FIVE measurement rows, not five physical pads. Its footer lists measurement rows; it does not change the physical pad count.
Use this explicit physical-pad-to-reference-row mapping:
- Physical pad 1 at the wet tip: reference row 1 totalChlorine and row 2 bromine. These rows share identical swatches and are alternative sanitizer scales of this ONE pad.
- Physical pad 2: reference row 3 freeChlorine. It is NOT the third physical pad.
- Physical pad 3: reference row 4 ph, NOT freeChlorine.
- Physical pad 4 nearest the long blank handle: reference row 5 alkalinity.
The reference's total-chlorine/bromine swatches are yellow-green to green, free-chlorine swatches cream to purple, pH swatches orange to red, and alkalinity swatches yellow/olive/green to blue-green. These describe reference families, not required camera RGBs. Position and strip orientation identify each pad; a green color alone cannot distinguish total chlorine from alkalinity.
Read totalChlorine and freeChlorine independently from their own physical pads. Never add the TC and bromine scales, infer TC from FC, or copy a numerical level between different pad rows. White carrier gaps and the blank handle are not reagent pads.
Read only the discrete values listed below. TC and bromine share a pad and must use the same color-level index.
Column indexes start at zero separately for each row. An adjacent-level ambiguity belongs in that pad's assessment; an unreadable color must never be guessed. Do not force a value solely from a color name such as turquoise.
${rows}`;
}
