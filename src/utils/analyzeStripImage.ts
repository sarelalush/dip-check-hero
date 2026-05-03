// Brand-aware pool test strip analyzer.
// Sends the strip's pad list to the Vision AI; falls back to local CV
// for the legacy 4-in-1 layout when AI is low-confidence.

import { targetRanges } from "@/config/targetRanges";
import {
  PARAM_LABEL_HE,
  type StripParameter,
  type StripBrand,
  getBrand,
  DEFAULT_BRAND_ID,
} from "@/config/stripBrands";
import { analyzeStripWithAI } from "@/server/strip-analysis.functions";
import { analyzeStripPixels } from "./colorUtils";

export type Status = "low" | "ok" | "high";

export interface StripReading {
  labelHe: string;
  value: number;
  unit: string;
  status: Status;
}

export interface StripResults {
  brandId: string;
  /** Readings keyed by parameter — only the ones the brand measures appear. */
  readings: Partial<Record<StripParameter, StripReading>>;
  source: "ai" | "cv" | "mock";
  confidence: number;
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
  const r = targetRanges[key];
  if (!r) return "ok"; // no target defined → don't flag
  if (value < r.min) return "low";
  if (value > r.max) return "high";
  return "ok";
}

function makeReading(p: StripParameter, value: number): StripReading {
  const def = PARAM_LABEL_HE[p];
  return { labelHe: def.labelHe, value, unit: def.unit, status: statusOf(value, p) };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

function attachLegacyAliases(results: StripResults): StripResults {
  results.freeChlorine = results.readings.freeChlorine;
  results.ph = results.readings.ph;
  results.alkalinity = results.readings.alkalinity;
  results.salt = results.readings.salt;
  return results;
}

/**
 * Analyze a pool test strip image.
 * @param image  File or data URL of the strip
 * @param brandId  Strip brand id (see src/config/stripBrands.ts). Falls back to default.
 */
export async function analyzeStripImage(
  image: File | string,
  brandId: string = DEFAULT_BRAND_ID,
): Promise<StripResults> {
  const dataUrl = typeof image === "string" ? image : await fileToDataUrl(image);
  const brand: StripBrand = getBrand(brandId);

  let aiResult: Awaited<ReturnType<typeof analyzeStripWithAI>> | null = null;
  try {
    aiResult = await analyzeStripWithAI({
      data: {
        imageBase64: dataUrl,
        brandId: brand.id,
        brandNameHe: brand.nameHe,
        parameters: brand.parameters,
      },
    });
  } catch (e) {
    console.warn("AI analyzer threw:", e);
  }

  // Hard block: AI says image isn't a strip.
  if (aiResult?.ok && aiResult.data.isStrip === false) {
    const r = aiResult.data.failureReason;
    const reason: FailureReason =
      r === "not_strip" || r === "blurry" || r === "lighting" || r === "framing"
        ? r
        : "not_strip";
    throw new StripNotDetectedError(reason, aiResult.data.notes || undefined);
  }

  // AI succeeded with usable confidence
  if (aiResult?.ok && aiResult.data.isStrip && aiResult.data.confidence >= 0.4) {
    const d = aiResult.data;
    const readings: StripResults["readings"] = {};
    for (const p of brand.parameters) {
      const v = d.values[p];
      if (typeof v === "number" && !Number.isNaN(v)) {
        readings[p] = makeReading(p, v);
      }
    }
    return attachLegacyAliases({
      brandId: brand.id,
      readings,
      source: "ai",
      confidence: d.confidence,
      notes: d.notes,
    });
  }

  // AI low-confidence — local CV fallback works only for the classic 4-pad layout.
  const cvCompatible =
    brand.parameters.includes("freeChlorine") &&
    brand.parameters.includes("ph") &&
    brand.parameters.includes("alkalinity");

  if (aiResult?.ok && aiResult.data.isStrip && cvCompatible) {
    try {
      const cv = await analyzeStripPixels(dataUrl);
      const readings: StripResults["readings"] = {
        freeChlorine: makeReading("freeChlorine", cv.freeChlorine),
        ph: makeReading("ph", cv.ph),
        alkalinity: makeReading("alkalinity", cv.alkalinity),
      };
      return attachLegacyAliases({
        brandId: brand.id,
        readings,
        source: "cv",
        confidence: cv.confidence,
        notes: "ביטחון נמוך, מוצג ניתוח פיקסלים מקומי. צלם שוב באור טוב לשיפור הדיוק.",
      });
    } catch (e) {
      console.error("CV fallback failed:", e);
    }
  }

  const errMsg =
    aiResult && !aiResult.ok && "message" in aiResult
      ? `ניתוח התמונה נכשל: ${aiResult.message}.`
      : "ניתוח התמונה נכשל. נסה שוב.";
  throw new StripNotDetectedError("ai_error", errMsg);
}
