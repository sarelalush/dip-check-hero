// Parity source: src/config/brandSwatches.ts.

import { PARAM_LABEL_HE, type ParamSwatches, type StripBrand, type StripParameter } from '../domain/strip';

type RgbTuple = [number, number, number];
type SwatchRef = [number, RgbTuple][];

const rgb = (r: number, g: number, b: number) => `rgb(${r}, ${g}, ${b})`;

const PRO: Partial<Record<StripParameter, SwatchRef>> = {
  totalChlorine: [
    [0, [254, 254, 168]],
    [0.5, [242, 254, 170]],
    [1, [231, 245, 160]],
    [3, [184, 216, 140]],
    [5, [100, 180, 105]],
    [10, [55, 140, 80]],
  ],
  bromine: [
    [0, [254, 254, 168]],
    [1, [242, 254, 170]],
    [2, [231, 245, 160]],
    [5, [184, 216, 140]],
    [10, [100, 180, 105]],
    [20, [55, 140, 80]],
  ],
  freeChlorine: [
    [0, [254, 254, 204]],
    [0.5, [247, 235, 228]],
    [1, [235, 215, 225]],
    [3, [220, 180, 210]],
    [5, [190, 125, 192]],
    [10, [130, 55, 160]],
    [20, [70, 15, 100]],
  ],
  ph: [
    [6.2, [242, 200, 90]],
    [6.8, [240, 170, 130]],
    [7.2, [235, 150, 150]],
    [7.8, [220, 130, 165]],
    [8.4, [195, 110, 170]],
  ],
  alkalinity: [
    [0, [227, 192, 64]],
    [40, [164, 169, 51]],
    [80, [137, 159, 58]],
    [120, [85, 130, 90]],
    [180, [55, 105, 100]],
    [240, [40, 90, 120]],
  ],
};

const YELLOW: Partial<Record<StripParameter, SwatchRef>> = {
  freeChlorine: [
    [0, [248, 245, 230]],
    [1, [240, 205, 215]],
    [3, [228, 150, 180]],
    [5, [200, 95, 150]],
    [10, [135, 40, 115]],
  ],
  ph: [
    [6.2, [245, 225, 90]],
    [6.8, [240, 180, 80]],
    [7.2, [235, 135, 75]],
    [7.8, [220, 90, 70]],
    [8.4, [180, 55, 55]],
  ],
  alkalinity: [
    [0, [235, 210, 80]],
    [40, [190, 200, 90]],
    [80, [140, 185, 100]],
    [120, [100, 165, 100]],
    [180, [50, 130, 90]],
    [240, [35, 110, 120]],
  ],
  cyanuricAcid: [
    [0, [240, 240, 235]],
    [30, [220, 215, 200]],
    [50, [195, 190, 180]],
    [100, [165, 155, 140]],
    [150, [120, 110, 100]],
  ],
};

const FALLBACK: Record<StripParameter, SwatchRef> = {
  freeChlorine: [
    [0, [248, 245, 230]],
    [1, [240, 200, 215]],
    [3, [225, 145, 180]],
    [5, [195, 90, 150]],
    [10, [130, 40, 110]],
  ],
  totalChlorine: [
    [0, [254, 254, 168]],
    [1, [231, 245, 160]],
    [3, [184, 216, 140]],
    [5, [100, 180, 105]],
    [10, [55, 140, 80]],
  ],
  bromine: [
    [0, [254, 254, 168]],
    [2, [231, 245, 160]],
    [5, [184, 216, 140]],
    [10, [100, 180, 105]],
    [20, [55, 140, 80]],
  ],
  ph: [
    [6.2, [245, 215, 95]],
    [6.8, [240, 175, 100]],
    [7.2, [235, 140, 110]],
    [7.8, [220, 105, 130]],
    [8.4, [185, 80, 130]],
  ],
  alkalinity: [
    [0, [235, 205, 80]],
    [40, [180, 195, 95]],
    [80, [130, 180, 105]],
    [120, [90, 155, 100]],
    [180, [50, 125, 95]],
    [240, [35, 105, 115]],
  ],
  cyanuricAcid: [
    [0, [240, 240, 235]],
    [30, [220, 215, 200]],
    [50, [195, 190, 180]],
    [100, [165, 155, 140]],
    [150, [120, 110, 100]],
  ],
  hardness: [
    [0, [220, 80, 110]],
    [50, [200, 100, 130]],
    [120, [170, 110, 145]],
    [250, [130, 100, 165]],
    [500, [70, 80, 165]],
  ],
  salt: [
    [500, [240, 240, 230]],
    [1500, [220, 225, 220]],
    [2700, [195, 215, 215]],
    [3500, [160, 200, 215]],
    [5000, [110, 175, 215]],
  ],
};

const BRAND_REFS: Record<string, Partial<Record<StripParameter, SwatchRef>>> = {
  'aquachek-pro-5in1': PRO,
  'aquachek-yellow-4': YELLOW,
};

function formatSwatchLabel(param: StripParameter, value: number) {
  if (param === 'ph') return value.toFixed(1);
  if (param === 'freeChlorine' || param === 'totalChlorine' || param === 'bromine') {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  }
  return `${value}`;
}

export function getBrandSwatches(brand: StripBrand): ParamSwatches[] {
  const brandRef = BRAND_REFS[brand.id] ?? {};
  return brand.parameters.map((parameter) => {
    const data = brandRef[parameter] ?? FALLBACK[parameter];
    const meta = PARAM_LABEL_HE[parameter];
    return {
      paramKey: parameter,
      labelHe: meta.labelHe,
      unit: meta.unit,
      swatches: data.map(([value, [r, g, b]]) => ({
        value,
        label: formatSwatchLabel(parameter, value),
        color: rgb(r, g, b),
      })),
    };
  });
}
