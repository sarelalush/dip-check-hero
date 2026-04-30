export type PoolShape = "rectangle" | "round" | "oval";

export interface VolumeInputRect {
  shape: "rectangle";
  length: number; // meters
  width: number;
  depth: number;
}
export interface VolumeInputRound {
  shape: "round";
  diameter: number;
  depth: number;
}
export interface VolumeInputOval {
  shape: "oval";
  length: number;
  width: number;
  depth: number;
}

export type VolumeInput = VolumeInputRect | VolumeInputRound | VolumeInputOval;

/** Returns volume in liters */
export function calculatePoolVolume(input: VolumeInput): number {
  let cubicMeters = 0;
  if (input.shape === "rectangle") {
    cubicMeters = input.length * input.width * input.depth;
  } else if (input.shape === "round") {
    const r = input.diameter / 2;
    cubicMeters = r * r * Math.PI * input.depth;
  } else {
    cubicMeters = input.length * input.width * input.depth * 0.785;
  }
  return Math.round(cubicMeters * 1000);
}
