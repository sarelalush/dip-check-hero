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

const AQUACHEK_PRO_CHART = `
OFFICIAL AquaChek Pro 5-in-1 color chart (memorize and use this — do NOT
guess colors from generic strip knowledge):

Total Chlorine + Total Bromine (pads 1 and 2) — yellow → green. The printed
scale on the bottle has 7 levels: 0, 0.5, 1, 3, 5, 10, 20.
  TC 0     / TB 0    → very pale cream-yellow  (R254 G254 B168)
  TC 0.5   / TB 0.5  → pale yellow-green       (R242 G254 B170)
  TC 1     / TB 1    → light yellow-green      (R231 G245 B160)
  TC 3     / TB 3    → light green             (R184 G216 B140)
  TC 5     / TB 5    → medium green            (R144 G198 B120)
  TC 10    / TB 10   → dark green              (R76  G163 B95)
  TC 20    / TB 20   → very dark green         (R40  G120 B70)

Free Chlorine (pad 3) — cream → PURPLE (NOT orange or red). The printed scale
on the bottle has 7 levels: 0, 0.5, 1, 3, 5, 10, 20.
  FC 0    → pale cream              (R254 G254 B204)
  FC 0.5  → very pale yellow        (R247 G249 B225)
  FC 1    → pale beige/lavender     (R230 G223 B215)
  FC 3    → light purple            (R172 G139 B208)
  FC 5    → medium purple           (R158 G106 B189)
  FC 10   → dark purple             (R129 G29  B153)
  FC 20   → very dark purple        (R60  G10  B90)

pH (pad 4) — orange → red:
  pH 6.2  → orange-yellow   (R242 G175 B60)
  pH 6.8  → orange          (R234 G106 B45)
  pH 7.2  → red-orange      (R225 G80  B50)
  pH 7.8  → red             (R210 G55  B45)
  pH 8.4  → dark red        (R180 G45  B45)

Total Alkalinity (pad 5) — yellow-green → dark teal:
  TA 0    → yellow-green    (R227 G192 B64)
  TA 40   → olive green     (R164 G169 B51)
  TA 80   → olive green     (R137 G159 B58)
  TA 120  → dark green      (R72  G111 B54)
  TA 180  → very dark green (R35  G82  B46)
  TA 240  → dark teal-blue  (R37  G87  B98)
`;

const AQUACHEK_YELLOW_CHART = `
OFFICIAL AquaChek Yellow 4-in-1 color chart (memorize and use this — do NOT
guess colors from generic strip knowledge). The strip has EXACTLY 4 pads in
this printed order from top to bottom:

Pad 1 — Free Chlorine (white → pink → magenta/purple, NOT yellow/green):
  FC 0    → near-white                  (R248 G245 B230)
  FC 1    → light pink                  (R240 G205 B215)
  FC 3    → pink                        (R228 G150 B180)
  FC 5    → magenta                     (R200 G95  B150)
  FC 10   → dark purple/magenta         (R135 G40  B115)

Pad 2 — pH (yellow → orange → red):
  pH 6.2  → bright yellow               (R245 G225 B90)
  pH 6.8  → orange-yellow               (R240 G180 B80)
  pH 7.2  → orange                      (R235 G135 B75)
  pH 7.8  → red-orange                  (R220 G90  B70)
  pH 8.4  → dark red                    (R180 G55  B55)

Pad 3 — Total Alkalinity (yellow-green → green → teal):
  TA 0    → yellow                      (R235 G210 B80)
  TA 40   → yellow-green                (R190 G200 B90)
  TA 80   → light green                 (R140 G185 B100)
  TA 120  → green                       (R100 G165 B100)
  TA 180  → dark green                  (R50  G130 B90)
  TA 240  → teal/blue-green             (R35  G110 B120)

Pad 4 — Cyanuric Acid (turbidity pad — white → tan/gray, never bright):
  CYA 0   → white                       (R240 G240 B235)
  CYA 30  → very light tan              (R220 G215 B200)
  CYA 50  → light gray-tan              (R195 G190 B180)
  CYA 100 → tan-gray                    (R165 G155 B140)
  CYA 150 → dark gray-brown             (R120 G110 B100)
`;

function buildSystemPrompt(brandNameHe: string, params: ParamKey[]) {
  const padList = params
    .map((p, i) => `${i + 1}. ${p} — ${PARAM_HINTS[p]}`)
    .join("\n");
  const isAquachekPro =
    params.includes("totalChlorine") &&
    params.includes("bromine") &&
    params.includes("freeChlorine") &&
    params.includes("ph") &&
    params.includes("alkalinity");
  const isAquachekYellow =
    params.length === 4 &&
    params.includes("freeChlorine") &&
    params.includes("ph") &&
    params.includes("alkalinity") &&
    params.includes("cyanuricAcid");
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
manufacturer chart for that brand. Critical rules:
- Read pads in the EXACT printed order listed above. Do not reorder by your
  own assumptions about which color "should" be which parameter.
- Interpolate between two nearest reference levels when the pad color is
  between them; do not snap only to listed values.
- Account for white balance: if the whole image has a yellow/blue cast,
  mentally neutralize it before comparing colors.
${isAquachekPro ? AQUACHEK_PRO_CHART : ""}${isAquachekYellow ? AQUACHEK_YELLOW_CHART : ""}
Return values via the report_strip tool. Only include the parameters listed
above — leave the others as 0.`;
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
          temperature: 0,
          top_p: 0.1,
          seed: 42,
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
