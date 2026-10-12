import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PARAM_KEYS = ["freeChlorine", "totalChlorine", "bromine", "ph", "alkalinity", "cyanuricAcid", "hardness", "salt"] as const;
type ParamKey = (typeof PARAM_KEYS)[number];
const inputSchema = z.object({
  imageBase64: z.string().min(100).max(12 * 1024 * 1024),
  brandId: z.string().optional(),
  brandNameHe: z.string().optional(),
  parameters: z.array(z.enum(PARAM_KEYS)).min(1).max(8),
});
type LegacyAnalysisResponse =
  | { ok: true; data: { isStrip: boolean; failureReason: string; values: Record<ParamKey, number>; confidence: number; notes?: string } }
  | { ok: false; error: string; message: string };

// This legacy gateway has no verified consent flow or processor agreement.
// It must be replaced by the authenticated, consent-gated Edge Function before
// web analysis can be offered again. No provider call is made by this endpoint.
export const analyzeStripWithAI = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async (): Promise<LegacyAnalysisResponse> => ({
    ok: false,
    error: "legacy_analysis_disabled",
    message: "ניתוח חדש באתר אינו זמין עד השלמת עדכון השירות. אפשר לצפות בתוצאות קיימות.",
  }));
