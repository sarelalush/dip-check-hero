import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PARAM_KEYS = [
  "freeChlorine",
  "totalChlorine",
  "bromine",
  "ph",
  "alkalinity",
  "cyanuricAcid",
  "hardness",
  "salt",
] as const;
type ParamKey = (typeof PARAM_KEYS)[number];

const inputSchema = z.object({
  imageBase64: z.string().min(100),
  /** Brand id, for context only — used to build the prompt. */
  brandId: z.string().optional(),
  brandNameHe: z.string().optional(),
  /** Pads to read in printed order (top→bottom). Drives the prompt + tool schema. */
  parameters: z.array(z.enum(PARAM_KEYS)).min(1).max(8),
});

const PARAM_HINTS: Record<ParamKey, string> = {
  freeChlorine: "freeChlorine: ppm, typical 0-10",
  totalChlorine: "totalChlorine: ppm, typical 0-10",
  bromine: "bromine: ppm, typical 0-20",
  ph: "ph: 6.2-8.4",
  alkalinity: "alkalinity: ppm, typical 0-240",
  cyanuricAcid: "cyanuricAcid: ppm (CYA / stabilizer), typical 0-150",
  hardness: "hardness: ppm (total/calcium), typical 0-1000",
  salt: "salt: ppm, typical 0-6000",
};

function buildSystemPrompt(brandNameHe: string, params: ParamKey[]) {
  const padList = params
    .map((p, i) => `${i + 1}. ${p} — ${PARAM_HINTS[p]}`)
    .join("\n");
  return `You are an expert pool/spa water test strip analyzer.
The user is using this strip brand: "${brandNameHe}".
This strip has EXACTLY these pads, in this printed order from top to bottom:
${padList}

FIRST determine if the image actually shows a pool/spa test strip (a thin plastic strip with multiple colored pads).
If NOT, set isStrip=false, confidence=0, all values=0, and put a short Hebrew note.

Classify failureReason as one of:
- "none": clear, usable strip
- "not_strip": no test strip visible
- "blurry": strip visible but out of focus
- "lighting": bad lighting / glare / strong color cast
- "framing": strip cut off, too far, or some pads not visible
- "low_confidence": strip readable but you are unsure of values

For not_strip / blurry / lighting / framing → isStrip=false.
For low_confidence → isStrip=true, confidence < 0.4.
Always provide a short, actionable Hebrew tip in notes.

If the strip IS readable, read each pad above by comparing its color to the
standard manufacturer chart for that brand. Return values via the report_strip
tool. Only include the parameters listed above — leave the others as 0.`;
}

export const analyzeStripWithAI = createServerFn({ method: "POST" })
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI gateway is not configured" };
    }

    const params = data.parameters as ParamKey[];
    const brandNameHe = data.brandNameHe ?? "סטיק בדיקה כללי";
    const systemPrompt = buildSystemPrompt(brandNameHe, params);

    const imageUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:image/jpeg;base64,${data.imageBase64}`;

    // Build dynamic tool schema — every numeric param is a number field.
    const numberProps: Record<string, { type: "number" }> = {};
    for (const k of PARAM_KEYS) numberProps[k] = { type: "number" };

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this ${brandNameHe} strip. Return values via report_strip.`,
                },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "report_strip",
                description: "Report parsed pool test strip values",
                parameters: {
                  type: "object",
                  properties: {
                    isStrip: { type: "boolean" },
                    failureReason: {
                      type: "string",
                      enum: ["none", "not_strip", "blurry", "lighting", "framing", "low_confidence"],
                    },
                    ...numberProps,
                    confidence: { type: "number" },
                    notes: { type: "string" },
                  },
                  required: ["isStrip", "failureReason", "confidence", "notes"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "report_strip" } },
        }),
      });

      if (response.status === 429) {
        return { ok: false as const, error: "rate_limit", message: "יותר מדי בקשות, נסה שוב בעוד רגע" };
      }
      if (response.status === 402) {
        return { ok: false as const, error: "credits", message: "נדרשת טעינת קרדיטים ב-Lovable AI" };
      }
      if (!response.ok) {
        const txt = await response.text();
        console.error("AI gateway error:", response.status, txt);
        return { ok: false as const, error: "gateway_error", message: `שגיאה (${response.status})` };
      }

      const json = await response.json();
      const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        return { ok: false as const, error: "no_tool_call", message: "המודל לא החזיר תוצאה" };
      }
      const args = JSON.parse(toolCall.function.arguments);

      // Only return values for the requested parameters.
      const values: Partial<Record<ParamKey, number>> = {};
      for (const p of params) {
        if (typeof args[p] === "number") values[p] = Number(args[p]);
      }

      return {
        ok: true as const,
        data: {
          isStrip: Boolean(args.isStrip),
          failureReason: (args.failureReason ?? "none") as
            | "none" | "not_strip" | "blurry" | "lighting" | "framing" | "low_confidence",
          values,
          confidence: Number(args.confidence ?? 0.5),
          notes: String(args.notes ?? ""),
        },
      };
    } catch (e) {
      console.error("Strip analysis failed:", e);
      return { ok: false as const, error: "exception", message: e instanceof Error ? e.message : "שגיאה לא צפויה" };
    }
  });
