import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  imageBase64: z.string().min(100), // data URL or raw base64
  includeSalt: z.boolean().optional().default(false),
});

const SYSTEM_PROMPT = `You are an expert pool water test strip analyzer.
You receive an image of a pool/spa test strip (e.g. AquaChek style) with multiple colored test pads.
Carefully identify each test pad by its color and read the value by comparing it to the standard color chart for these strips.

Return ONLY a JSON object via the report_strip tool with the following fields:
- freeChlorine: ppm (typical range 0-10)
- ph: pH value (typical range 6.2-8.4)
- alkalinity: ppm (typical range 0-240)
- salt: ppm (typical range 0-4500), include only if a salt pad is present and includeSalt is true
- confidence: number between 0 and 1 indicating overall confidence
- notes: short Hebrew note if image is unclear or strip not detected, otherwise empty string

Be conservative: if a pad is unreadable, estimate from neighbors. If the image clearly does not show a test strip, set confidence to 0 and explain in notes (Hebrew).`;

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
                    freeChlorine: { type: "number" },
                    ph: { type: "number" },
                    alkalinity: { type: "number" },
                    salt: { type: "number" },
                    confidence: { type: "number" },
                    notes: { type: "string" },
                  },
                  required: ["freeChlorine", "ph", "alkalinity", "confidence", "notes"],
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
