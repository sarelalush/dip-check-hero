// Brand-aware pool test strip analyzer.
// One scan performs exactly one AI request and presents that response directly.

import { targetRanges } from "@/config/targetRanges";
import {
  PARAM_LABEL_HE,
  type StripParameter,
  type StripBrand,
  getBrand,
  DEFAULT_BRAND_ID,
} from "@/config/stripBrands";
import { analyzeStripWithAI } from "@/lib/strip-analysis.functions";

export type Status = "low" | "ok" | "high";

export interface StripReading {
  labelHe: string;
  value: number;
  unit: string;
  status: Status;
  agreement?: number;
}

export interface StripResults {
  brandId: string;
  readings: Partial<Record<StripParameter, StripReading>>;
  source: "ai" | "cv" | "mock";
  confidence: number;
  lowConfidence?: boolean;
  shotsUsed?: number;
  notes?: string;

  // Back-compat shortcuts (legacy code reads these directly).
  freeChlorine?: StripReading;
  ph?: StripReading;
  alkalinity?: StripReading;
  salt?: StripReading;
}

export type FailureReason =
  | "not_strip"
  | "blurry"
  | "lighting"
  | "framing"
  | "low_confidence"
  | "ai_error"
  | "unknown";

export class StripNotDetectedError extends Error {
  reason: FailureReason;

  constructor(reason: FailureReason = "unknown", message?: string) {
    super(message || "לא זוהה סטיק בדיקה בתמונה.");
    this.name = "StripNotDetectedError";
    this.reason = reason;
  }
}

function statusOf(value: number, key: StripParameter): Status {
  const range = targetRanges[key];
  if (!range) return "ok";
  if (value < range.min) return "low";
  if (value > range.max) return "high";
  return "ok";
}

function makeReading(parameter: StripParameter, value: number): StripReading {
  const definition = PARAM_LABEL_HE[parameter];
  return {
    labelHe: definition.labelHe,
    value,
    unit: definition.unit,
    status: statusOf(value, parameter),
  };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function attachLegacyAliases(results: StripResults): StripResults {
  results.freeChlorine = results.readings.freeChlorine;
  results.ph = results.readings.ph;
  results.alkalinity = results.readings.alkalinity;
  results.salt = results.readings.salt;
  return results;
}

function normalizeFailureReason(reason: string | undefined): FailureReason {
  return reason === "not_strip" ||
    reason === "blurry" ||
    reason === "lighting" ||
    reason === "framing" ||
    reason === "low_confidence"
    ? reason
    : "unknown";
}

/**
 * Sends the original image and selected strip brand to Gemini exactly once.
 * No white balance, local pixel analysis, consensus, retries or calibration
 * are performed here. The returned readings are Gemini's response.
 */
export async function analyzeStripImage(
  image: File | string,
  brandId: string = DEFAULT_BRAND_ID,
): Promise<StripResults> {
  const imageBase64 = typeof image === "string" ? image : await fileToDataUrl(image);
  const brand: StripBrand = getBrand(brandId);

  let response: Awaited<ReturnType<typeof analyzeStripWithAI>>;
  try {
    response = await analyzeStripWithAI({
      data: {
        imageBase64,
        brandId: brand.id,
        brandNameHe: brand.nameHe,
        parameters: brand.parameters,
      },
    });
  } catch (error) {
    console.error("Gemini strip analysis request failed:", error);
    throw new StripNotDetectedError(
      "ai_error",
      "שירות הניתוח אינו זמין כרגע. נסו שוב בעוד כמה דקות.",
    );
  }

  if (!response.ok) {
    throw new StripNotDetectedError(
      "ai_error",
      response.message || "שירות הניתוח אינו זמין כרגע. נסו שוב בעוד כמה דקות.",
    );
  }

  if (!response.data.isStrip) {
    throw new StripNotDetectedError(
      normalizeFailureReason(response.data.failureReason),
      response.data.notes || "Gemini לא זיהה בתמונה סטיק בדיקה מתאים.",
    );
  }

  const readings: StripResults["readings"] = {};
  for (const parameter of brand.parameters) {
    const value = response.data.values[parameter];
    if (typeof value === "number" && Number.isFinite(value)) {
      readings[parameter] = makeReading(parameter, value);
    }
  }

  return attachLegacyAliases({
    brandId: brand.id,
    readings,
    source: "ai",
    confidence: response.data.confidence,
    lowConfidence: response.data.failureReason === "low_confidence",
    shotsUsed: 1,
    notes: response.data.notes || undefined,
  });
}
