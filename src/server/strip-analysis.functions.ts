import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  imageBase64: z.string().min(100), // data URL or raw base64
  includeSalt: z.boolean().optional().default(false),
});

const SYSTEM_PROMPT = `You are an expert pool water test strip analyzer.
You receive an image and must FIRST determine whether it actually shows a pool/spa test strip
(e.g. AquaChek style — a thin plastic strip with multiple colored test pads).

If the image does NOT clearly show a pool test strip (e.g. it's a person, a pet, a landscape,
a random object, blurry, or any other non-strip image), set isStrip=false, confidence=0,
and put a short Hebrew explanation in notes.
Do NOT invent values — return 0 for all readings in that case.

You MUST also classify the failure reason in failureReason:
- "none": image is a clear, usable strip (isStrip=true, good quality)
- "not_strip": image does not show a pool test strip at all (a person, pet, landscape, random object)
- "blurry": a strip is visible but too out of focus to read pad colors reliably
- "lighting": a strip is visible but lighting is bad (too dark, overexposed, strong color cast, glare/reflection covering pads)
- "framing": a strip is visible but partially cut off, too far, too small, or pads not all visible
- "low_confidence": strip visible and readable but you are not very confident in the values

For not_strip / blurry / lighting / framing → set isStrip=false.
For low_confidence → set isStrip=true with confidence < 0.4.
Always provide a short, actionable Hebrew tip in notes matching the failureReason
(e.g. "התמונה מטושטשת — נסה לייצב את היד ולצלם שוב").

If the image DOES show a test strip, set isStrip=true and read each pad by comparing its color
to the standard chart for these strips. Return values via the report_strip tool:
- freeChlorine: ppm (typical 0-10)
- ph: 6.2-8.4
- alkalinity: ppm (typical 0-240)
- salt: ppm (only if a salt pad is visible AND includeSalt is true)
- confidence: 0-1, your overall confidence in the readings
- isStrip: boolean, whether the image shows a test strip
- notes: short Hebrew note (empty string if all is fine)`;

export const analyzeStripWithAI = createServerFn({ method: "POST" })
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI gateway is not configured" };
    }

    // Normalize to data URL
    const imageUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:image/jpeg;base64,${data.imageBase64}`;

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
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this pool test strip. includeSalt=${data.includeSalt}. Return values via the report_strip tool.`,
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
                    freeChlorine: { type: "number" },
                    ph: { type: "number" },
                    alkalinity: { type: "number" },
                    salt: { type: "number" },
                    confidence: { type: "number" },
                    notes: { type: "string" },
                  },
                  required: ["isStrip", "failureReason", "freeChlorine", "ph", "alkalinity", "confidence", "notes"],
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
      return {
        ok: true as const,
        data: {
          isStrip: Boolean(args.isStrip),
          failureReason: (args.failureReason ?? "none") as
            | "none" | "not_strip" | "blurry" | "lighting" | "framing" | "low_confidence",
          freeChlorine: Number(args.freeChlorine),
          ph: Number(args.ph),
          alkalinity: Number(args.alkalinity),
          salt: typeof args.salt === "number" ? args.salt : undefined,
          confidence: Number(args.confidence ?? 0.5),
          notes: String(args.notes ?? ""),
        },
      };
    } catch (e) {
      console.error("Strip analysis failed:", e);
      return { ok: false as const, error: "exception", message: e instanceof Error ? e.message : "שגיאה לא צפויה" };
    }
  });
