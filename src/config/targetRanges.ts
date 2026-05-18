export interface TargetRange {
  target: number;
  min: number;
  max: number;
}

export const targetRanges: Record<string, TargetRange> = {
  freeChlorine: { target: 2, min: 1, max: 3 },
  ph: { target: 7.4, min: 7.2, max: 7.6 },
  alkalinity: { target: 100, min: 80, max: 120 },
  salt: { target: 3200, min: 3000, max: 3500 },
  cyanuricAcid: { target: 40, min: 30, max: 50 },
  hardness: { target: 250, min: 200, max: 400 },
};
