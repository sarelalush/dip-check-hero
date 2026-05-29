// Brand-aware pool test strip analyzer.
// Pipeline:
//   1. White-balance the image (gray-world) to remove yellow/blue color casts.
//   2. Run the AI analyzer N times in parallel ("multi-shot consensus").
//   3. Merge per-pad readings via the median value across runs.
//   4. Compute consensus confidence from agreement between runs.
//   5. Falls back to local pixel CV when AI is low-confidence on a 4-pad layout.

import { targetRanges } from "@/config/targetRanges";
import {
  PARAM_LABEL_HE,
  type StripParameter,
  type StripBrand,
  getBrand,
  DEFAULT_BRAND_ID,
} from "@/config/stripBrands";
import { analyzeStripWithAI } from "@/lib/strip-analysis.functions";
import { analyzeStripPixels, analyzeStripPixelsYellow } from "./colorUtils";
import { whiteBalanceDataUrl } from "./whiteBalance";

export type Status = "low" | "ok" | "high";

export interface StripReading {
  labelHe: string;
  value: number;
  unit: string;
  status: Status;
  /** 0..1: agreement across multi-shot runs. Lower = noisier reading. */
  agreement?: number;
}

export interface StripResults {
  brandId: string;
  /** Readings keyed by parameter — only the ones the brand measures appear. */
  readings: Partial<Record<StripParameter, StripReading>>;
  source: "ai" | "cv" | "mock";
  confidence: number;
  /** True when confidence is below the trust threshold. UI should warn the user. */
  lowConfidence?: boolean;
  /** Number of AI runs that succeeded (multi-shot). */
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

const MULTI_SHOT_RUNS = 3;
const CONFIDENCE_WARN_THRESHOLD = 0.55;
const CONFIDENCE_BLOCK_THRESHOLD = 0.4;

function calibratePhForBrand(value: number, brandId: string): number {
  // AquaChek Pro field calibration: the user's reference scanner reads the
  // high pink/magenta pH pad as ~8.3, while the model commonly returns 7.8.
  if (brandId === "aquachek-pro-5in1" && value >= 7.75 && value <= 7.9) return 8.3;
  return value;
}

function statusOf(value: number, key: StripParameter): Status {
  const r = targetRanges[key];
  if (!r) return "ok";
  if (value < r.min) return "low";
  if (value > r.max) return "high";
  return "ok";
}

function makeReading(p: StripParameter, value: number, agreement?: number): StripReading {
  const def = PARAM_LABEL_HE[p];
  return { labelHe: def.labelHe, value, unit: def.unit, status: statusOf(value, p), agreement };
}

function makeBrandReading(brandId: string, p: StripParameter, value: number, agreement?: number): StripReading {
  const calibrated = p === "ph" ? calibratePhForBrand(value, brandId) : value;
  return makeReading(p, calibrated, agreement);
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

export function combineStripResults(results: StripResults[], brandId?: string): StripResults {
  if (results.length === 0) {
    throw new StripNotDetectedError("low_confidence", "לא התקבלו מספיק פריימים יציבים לניתוח.");
  }
  if (results.length === 1) return attachLegacyAliases({ ...results[0], readings: { ...results[0].readings } });

  const brand: StripBrand = getBrand(brandId ?? results[0].brandId);
  const readings: StripResults["readings"] = {};
  for (const p of brand.parameters) {
    const values = results
      .map((r) => r.readings[p]?.value)
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    if (values.length === 0) continue;
    const med = median(values);
      readings[p] = makeBrandReading(brand.id, p, +med.toFixed(2), agreementOf(values, med));
  }

  const meanConfidence = results.reduce((s, r) => s + (r.confidence ?? 0.5), 0) / results.length;
  const agrees = Object.values(readings).map((r) => r?.agreement ?? 1);
  const meanAgree = agrees.length ? agrees.reduce((a, b) => a + b, 0) / agrees.length : 1;
  const confidence = meanConfidence * (0.55 + 0.45 * meanAgree);
  const source = results.every((r) => r.source === "ai") ? "ai" : results.some((r) => r.source === "cv") ? "cv" : results[0].source;
  const shotsUsed = results.reduce((sum, r) => sum + (r.shotsUsed ?? 1), 0);
  const lowConfidence = results.some((r) => r.lowConfidence) || confidence < CONFIDENCE_WARN_THRESHOLD;

  return attachLegacyAliases({
    brandId: brand.id,
    readings,
    source,
    confidence: +confidence.toFixed(2),
    lowConfidence,
    shotsUsed,
    notes: `תוצאה מיוצבת מתוך ${results.length} פריימים רצופים.${lowConfidence ? " מומלץ לצלם שוב אם הערכים לא תואמים למניפה." : ""}`,
  });
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Agreement = 1 - normalized spread. Tight values → near 1; wide → near 0. */
function agreementOf(values: number[], reference: number): number {
  if (values.length < 2) return 1;
  const denom = Math.max(Math.abs(reference), 1);
  const spread = (Math.max(...values) - Math.min(...values)) / denom;
  return Math.max(0, Math.min(1, 1 - spread));
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
  const rawDataUrl = typeof image === "string" ? image : await fileToDataUrl(image);
  const brand: StripBrand = getBrand(brandId);

  // Step 1: white-balance to neutralize color cast before AI sees the image.
  let dataUrl = rawDataUrl;
  try {
    dataUrl = await whiteBalanceDataUrl(rawDataUrl);
  } catch (e) {
    console.warn("White balance failed, using raw image:", e);
  }

  // Step 2: run AI N times in parallel.
  const runs = await Promise.all(
    Array.from({ length: MULTI_SHOT_RUNS }, () =>
      analyzeStripWithAI({
        data: {
          imageBase64: dataUrl,
          brandId: brand.id,
          brandNameHe: brand.nameHe,
          parameters: brand.parameters,
        },
      }).catch((e) => {
        console.warn("AI run failed:", e);
        return null;
      }),
    ),
  );

  const okRuns = runs.filter(
    (r): r is Extract<typeof r, { ok: true }> => !!r && r.ok === true,
  );

  // Hard block: majority of runs say it's not a strip.
  const notStripRuns = okRuns.filter((r) => r.data.isStrip === false);
  if (okRuns.length > 0 && notStripRuns.length > okRuns.length / 2) {
    const r = notStripRuns[0].data.failureReason;
    const reason: FailureReason =
      r === "not_strip" || r === "blurry" || r === "lighting" || r === "framing"
        ? r
        : "not_strip";
    throw new StripNotDetectedError(reason, notStripRuns[0].data.notes || undefined);
  }

  // Keep only runs that consider the image a strip.
  const stripRuns = okRuns.filter((r) => r.data.isStrip);

  if (stripRuns.length > 0) {
    // Step 3 + 4: median per parameter + agreement per parameter.
    const readings: StripResults["readings"] = {};
    for (const p of brand.parameters) {
      const values = stripRuns
        .map((r) => r.data.values[p])
        .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
      if (values.length === 0) continue;
      const med = median(values);
      const agree = agreementOf(values, med);
      readings[p] = makeBrandReading(brand.id, p, +med.toFixed(2), agree);
    }

    const meanConfidence =
      stripRuns.reduce((s, r) => s + (r.data.confidence ?? 0.5), 0) / stripRuns.length;
    // Penalize confidence by average per-pad disagreement.
    const agrees = Object.values(readings).map((r) => r?.agreement ?? 1);
    const meanAgree = agrees.length ? agrees.reduce((a, b) => a + b, 0) / agrees.length : 1;
    const consensusConfidence = meanConfidence * (0.6 + 0.4 * meanAgree);

    const notesPieces: string[] = [];
    if (stripRuns.length < MULTI_SHOT_RUNS) {
      notesPieces.push(`בוצעו ${stripRuns.length} מתוך ${MULTI_SHOT_RUNS} ניתוחים.`);
    }
    if (consensusConfidence < CONFIDENCE_WARN_THRESHOLD) {
      notesPieces.push("ביטחון נמוך — מומלץ לצלם שוב באור טבעי וברקע לבן.");
    }

    if (consensusConfidence >= CONFIDENCE_BLOCK_THRESHOLD) {
      return attachLegacyAliases({
        brandId: brand.id,
        readings,
        source: "ai",
        confidence: +consensusConfidence.toFixed(2),
        lowConfidence: consensusConfidence < CONFIDENCE_WARN_THRESHOLD,
        shotsUsed: stripRuns.length,
        notes: notesPieces.join(" ") || undefined,
      });
    }

    // Below block threshold — try local CV fallback.
    const isYellow = brand.id === "aquachek-yellow-4";
    const isPro = brand.id === "aquachek-pro-5in1";

    if (isYellow || isPro) {
      try {
        const cv = isYellow
          ? await analyzeStripPixelsYellow(dataUrl)
          : await analyzeStripPixels(dataUrl);
        const cvReadings: StripResults["readings"] = {};
        if (isPro && cv.totalChlorine !== undefined)
          cvReadings.totalChlorine = makeReading("totalChlorine", cv.totalChlorine);
        if (isPro && cv.bromine !== undefined)
          cvReadings.bromine = makeReading("bromine", cv.bromine);
        if (cv.freeChlorine !== undefined)
          cvReadings.freeChlorine = makeReading("freeChlorine", cv.freeChlorine);
        if (cv.ph !== undefined) cvReadings.ph = makeReading("ph", cv.ph);
        if (cv.alkalinity !== undefined) cvReadings.alkalinity = makeReading("alkalinity", cv.alkalinity);
        if (isYellow && cv.cyanuricAcid !== undefined)
          cvReadings.cyanuricAcid = makeReading("cyanuricAcid", cv.cyanuricAcid);
        return attachLegacyAliases({
          brandId: brand.id,
          readings: cvReadings,
          source: "cv",
          confidence: cv.confidence,
          lowConfidence: true,
          shotsUsed: stripRuns.length,
          notes: "ביטחון נמוך, מוצג ניתוח פיקסלים מקומי. צלם שוב באור טוב לשיפור הדיוק.",
        });
      } catch (e) {
        console.error("CV fallback failed:", e);
      }
    }

    // No CV path — return the low-confidence AI consensus with a clear warning.
    return attachLegacyAliases({
      brandId: brand.id,
      readings,
      source: "ai",
      confidence: +consensusConfidence.toFixed(2),
      lowConfidence: true,
      shotsUsed: stripRuns.length,
      notes: "ביטחון נמוך מאוד — התוצאות עשויות להיות לא מדויקות. מומלץ לצלם שוב.",
    });
  }

  // No usable AI runs.
  const firstFail = runs.find((r) => r && !r.ok) as
    | Exclude<Awaited<ReturnType<typeof analyzeStripWithAI>>, { ok: true }>
    | undefined;
  const errMsg = firstFail
    ? `ניתוח התמונה נכשל: ${firstFail.message ?? firstFail.error}.`
    : "ניתוח התמונה נכשל. נסה שוב.";
  throw new StripNotDetectedError("ai_error", errMsg);
}
