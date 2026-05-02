// Hybrid pool test strip analyzer.
// Strategy: try Vision AI first; fallback to client-side pixel CV if AI fails or low confidence.

import { targetRanges } from "@/config/targetRanges";
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
  freeChlorine: StripReading;
  ph: StripReading;
  alkalinity: StripReading;
  salt?: StripReading;
  source: "ai" | "cv" | "mock";
  confidence: number;
  notes?: string;
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

function statusOf(value: number, key: keyof typeof targetRanges): Status {
  const r = targetRanges[key];
  if (value < r.min) return "low";
  if (value > r.max) return "high";
  return "ok";
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

/**
 * Analyze a pool test strip image.
 * @param image File or data URL of the strip
 * @param includeSalt include salt reading (saltwater pools)
 */
export async function analyzeStripImage(
  image: File | string,
  includeSalt = false,
): Promise<StripResults> {
  const dataUrl = typeof image === "string" ? image : await fileToDataUrl(image);

  // 1) Try Vision AI
  let aiResult: Awaited<ReturnType<typeof analyzeStripWithAI>> | null = null;
  try {
    aiResult = await analyzeStripWithAI({ data: { imageBase64: dataUrl, includeSalt } });
  } catch (e) {
    console.warn("AI analyzer threw:", e);
  }

  // If AI explicitly says it's NOT a strip — block immediately, don't fall back to CV
  // (CV would happily return garbage values for any image).
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
    const result: StripResults = {
      freeChlorine: { labelHe: "כלור חופשי", value: d.freeChlorine, unit: "ppm", status: statusOf(d.freeChlorine, "freeChlorine") },
      ph: { labelHe: "pH", value: d.ph, unit: "", status: statusOf(d.ph, "ph") },
      alkalinity: { labelHe: "אלקליניות", value: d.alkalinity, unit: "ppm", status: statusOf(d.alkalinity, "alkalinity") },
      source: "ai",
      confidence: d.confidence,
      notes: d.notes,
    };
    if (includeSalt && typeof d.salt === "number") {
      result.salt = { labelHe: "מלח", value: d.salt, unit: "ppm", status: statusOf(d.salt, "salt") };
    }
    return result;
  }

  // AI low confidence (but did identify a strip) — try CV as a sanity backup
  if (aiResult?.ok && aiResult.data.isStrip) {
    try {
      const cv = await analyzeStripPixels(dataUrl);
      return {
        freeChlorine: { labelHe: "כלור חופשי", value: cv.freeChlorine, unit: "ppm", status: statusOf(cv.freeChlorine, "freeChlorine") },
        ph: { labelHe: "pH", value: cv.ph, unit: "", status: statusOf(cv.ph, "ph") },
        alkalinity: { labelHe: "אלקליניות", value: cv.alkalinity, unit: "ppm", status: statusOf(cv.alkalinity, "alkalinity") },
        source: "cv",
        confidence: cv.confidence,
        notes: "ביטחון נמוך, מוצג ניתוח פיקסלים מקומי. צלם שוב באור טוב לשיפור הדיוק.",
      };
    } catch (e) {
      console.error("CV fallback failed:", e);
    }
  }

  // AI completely failed (network/gateway error) — block with a clear error
  const errMsg =
    aiResult && !aiResult.ok && "message" in aiResult
      ? `ניתוח התמונה נכשל: ${aiResult.message}.`
      : "ניתוח התמונה נכשל. נסה שוב.";
  throw new StripNotDetectedError("ai_error", errMsg);
}
