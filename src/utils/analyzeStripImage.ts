// Modular strip analyzer. MVP: returns mock results.
// Replace internals with real CV pipeline later — same return shape.

export type Status = "low" | "ok" | "high";

export interface StripReading {
  labelHe: string;
  value: number;
  unit: string;
  status: Status;
}

export interface StripResults {
  freeChlorine: StripReading;
  ph: StripReading;
  alkalinity: StripReading;
  salt?: StripReading;
}

import { targetRanges } from "@/config/targetRanges";

function statusOf(value: number, key: keyof typeof targetRanges): Status {
  const r = targetRanges[key];
  if (value < r.min) return "low";
  if (value > r.max) return "high";
  return "ok";
}

/**
 * Analyze a pool test strip image.
 * Currently returns mock data with slight randomization.
 * @param _image File or data URL of the strip
 * @param includeSalt whether to include salt reading (saltwater pools)
 */
export async function analyzeStripImage(
  _image: File | string,
  includeSalt = false,
): Promise<StripResults> {
  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 1400));

  // Mock: pick plausible "needs adjustment" values
  const fc = +(Math.random() * 1.2 + 0.3).toFixed(1); // 0.3-1.5 (often low)
  const ph = +(Math.random() * 0.8 + 7.4).toFixed(1); // 7.4-8.2
  const alk = Math.round(Math.random() * 60 + 70); // 70-130
  const salt = Math.round(Math.random() * 1000 + 2400); // 2400-3400

  const result: StripResults = {
    freeChlorine: {
      labelHe: "כלור חופשי",
      value: fc,
      unit: "ppm",
      status: statusOf(fc, "freeChlorine"),
    },
    ph: {
      labelHe: "pH",
      value: ph,
      unit: "",
      status: statusOf(ph, "ph"),
    },
    alkalinity: {
      labelHe: "אלקליניות",
      value: alk,
      unit: "ppm",
      status: statusOf(alk, "alkalinity"),
    },
  };

  if (includeSalt) {
    result.salt = {
      labelHe: "מלח",
      value: salt,
      unit: "ppm",
      status: statusOf(salt, "salt"),
    };
  }

  return result;
}
