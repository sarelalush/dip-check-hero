# AquaChek Pro color reference

The versioned source is `supabase/functions/_shared/aquachek-pro-chart.json`.
It is imported by the client swatches, display ranges and color matcher, and
copied to `strip_brands.color_chart` by a migration. The production Edge Function
loads one validated DB snapshot per request for the model prompt, discrete-value
checks, diagnostic pixel comparison and cache identity.

## Source and scope

On 2026-10-13 the project owner supplied the original JPEG archived here and
identified its source as the manufacturer or bottle label. The status
`user_supplied_label` records this statement; it does not claim independent
manufacturer verification or field calibration. Use this profile only for the
strip/chart variant shown in this image, including TC 20 and bromine 40.

Image SHA-256: `5b78395fb5d9cd7c89d3adc29fd3016d0c9edd797a1f9d7ed30055709e3657e5`.

`extracted-swatches.json` records the original dimensions, each numeric label,
sampling rectangles and observed channel ranges. Reference RGBs are channel
medians from four interior regions, avoiding borders and printed numbers.
TC and bromine share one physical pad, so their corresponding columns use the
pooled medians from both rows. The original JPEG is unchanged.

| Parameter | Discrete levels |
|---|---|
| Total chlorine | 0, 0.5, 1, 3, 5, 10, 20 ppm |
| Bromine | 0, 1, 2, 5, 10, 20, 40 ppm |
| Free chlorine | 0, 0.5, 1, 3, 5, 10, 20 ppm |
| pH | 6.2, 6.8, 7.2, 7.8, 8.4 |
| Total alkalinity | 0, 40, 80, 120, 180, 240 ppm |

## Reading behavior and limits

One model request visually reads the four pads in physical wet-tip-to-handle
order. When the DB snapshot matches the bundled source, the unchanged supplied
chart JPEG is attached as a second reference image in the same request. The first
image alone is assessed as the user's strip. The reference image hash also forms
part of cache identity. A changed DB reference never uses a stale bundled image.

The model must identify one continuous strip with four complete intact pads,
meaningful confidence and no reading failure, and return listed levels only.
TC/bromine must select the same column. Severe unreadability, missing/damaged
pads, wrong strip architecture and invalid values
still reject the scan.

Version 27 retains four independent pad assessments: observed
dominant colour, zero-based chart column, adjacent alternative, certainty and
focus. Each selected index must agree with its numeric value. A nearby
alternative is retained as uncertainty even if the model calls the match clear;
this wording conflict does not reject a readable photograph. A genuinely
unreadable representative colour does. Focus softness alone does not. Adjacent uncertainty is preserved per
metric and the client can show the alternative printed level concisely.

Model pad boxes and CIELAB comparison are diagnostic aids. They are not calibrated
for phone lighting, exposure or localization error. Approximate boxes, a failed
local neutral-carrier/focus estimate, raw RGB distance, competing pixel matches
or disagreement with the model do not independently reject a readable strip.
They are stored as diagnostic warnings. Per-parameter color conflict or ambiguity
sets `needsVerification`; the client presents a short verification note without
hiding the reading. Selected values come from the model, never from an arbitrary
pixel override. Confidence is explicitly labelled `model-reported` in evidence.

A separate focus heuristic checks curvature relative to gradient energy in each
localized pad at a step relative to pad width. Its low-detail result is diagnostic
only: it adds a warning and per-metric verification hints, never a scan rejection.
The model's focus label also does not independently veto a readable chart match.
The previous v26 audit rejected one photo through this local focus heuristic;
that automatic veto was removed at the owner's request in v27. The original
v26 audit report remains a historical record, not evidence of v27 outcomes.
These focus estimates have not been validated across a representative phone/
lighting dataset. Ordinary phones and soft pad edges are expected inputs.

The result stores the reference revision/image inclusion, color evidence and
model-reported confidence. Rejection records retain available audit evidence.
Small images may be decoded for optional diagnostics. Larger phone photographs
within the existing 24MP and 8MiB input limits still use the model/chart path;
they are not locally decoded merely to satisfy a pixel-sampling requirement.

The distance, separation, focus and confidence thresholds are heuristics.
Reference pixels alone cannot establish accuracy for camera exposure, lighting,
strip lot, read time or chemistry. Confidence is not a measured accuracy
percentage. Physical readings compared with a separate measurement method are
still needed to quantify accuracy.

No historical user results are overwritten or automatically reanalyzed.

## Pad identity and chlorine presentation (2026-10-18)

Version 28 explicitly maps four physical pads to the five reference rows:
pad 1 -> TC row 1 / alternative bromine row 2; pad 2 -> FC row 3;
pad 3 -> pH row 4; pad 4 -> alkalinity row 5. The supplied image footer's
five-item list must not be interpreted as five physical reagent pads. TC/FC
are independently read; neither the two sanitizer scales nor different pad
values are added or copied to obtain a chlorine estimate. The chart, levels,
phone-photo acceptance rules, and diagnostic-only pixel behavior are unchanged.

The mobile results show total chlorine separately without assigning it the
free-chlorine target, treatment order or dose. Canonical parameter labels also
disambiguate saved results that previously called FC simply "chlorine". When
reported TC is below FC, both displayed readings request verification; no
reported number is altered, and no combined-chlorine quantity is inferred.
Pro results missing TC remain partial and display "not read", without filling
in a value or offering a treatment step from an incomplete Pro result.
This presentation/identity change is not field calibration or a demonstrated
improvement in numerical reading accuracy. No new scans/provider evaluations
were run for it, in accordance with AGENTS.md.

The owner's subsequent visual request orders result cards by physical pad:
TC, FC, pH, alkalinity; this is separate from the treatment-step order.
Each card has a source-labelled color sample. For Pro, four stored diagnostic
padRgbs supply image-region averages only when their identity has been aligned
to a unique four-band physical sequence (v29 padColorIdentity=structure-aligned).
These samples can include localization or exposure error and are not calibrated
pad colors. If no such sample exists, an available referenceRgb is explicitly
labelled as a chart color; without either, the UI shows that no color was saved.
No color is reconstructed from a value or guessed from a model color name.

The graphic now displays TC, pH and alkalinity. TC is a measurement-only arc:
it has no free-chlorine target, target marker or health/status classification.
The graph preserves approximate-value notation and omits scale percentages,
which were not confidence or water-safety scores. Treatment still uses its
existing independently read free-chlorine parameter and treatment order.

## Diagnostic sample alignment (v29)

The user's actual v28 result on 2026-10-18 exposed model boxes centered at
0.08/0.18/0.28/0.38 of image height. These sampled background / TC / FC / pH,
omitting the real alkalinity pad. The local structure evidence already contained
the four reagent bands, but the fourth had been discarded from the model-based
envelope. Model color descriptions and numeric readings were separate from
these mistaken coordinates; swatch errors do not validate or invalidate those
numerical estimates by themselves.

V29 considers both selected and previously ignored image bands. Only a unique
sequence of four distinct, regularly spaced bands, geometrically compatible
with a common model-coordinate offset, refines diagnostic sampling boxes.
Original model boxes are retained alongside sampled boxes for audit. Ambiguous
or incomplete geometry remains unverified and cannot supply photo swatches.
Older untagged samples also fall back to explicitly labelled reference colors;
historical numeric results and model confidence are not rewritten.

These new geometric thresholds are display/diagnostic heuristics, not validated
chemical calibration or scan rejection rules. No image-only replay, test scan
or extra paid model evaluation was run; code review and static checks only.

## Source-photo swatches (v30)

The UI now shows a clipped square from the original source image instead of
turning a diagnostic RGB average into a flat color. The central 58% of the
smaller aligned pad dimension defines the square, avoiding carrier edges.
There is no tint, white-balance correction, saturation boost, JPEG re-encoding,
or chart-color substitution inside a photo preview. Image loading completes
before the swatch is labelled as a photo; load failures use an explicitly
labelled reference fallback or missing-color state.

The four-band geometry helper is shared by the Edge Function and mobile.
Saved scans can use their stored model boxes and visible/ignored bands to
realign the display locally, without sending the image to Gemini or rewriting
historical values. Preview dimensions come from the source image; server image
dimensions (stored starting v30) or existing capture-quality dimensions anchor
the stored band coordinates. An aspect-ratio mismatch, ambiguous geometry or
unavailable source image prevents a photo crop from being presented.
If the local source has expired but the private scan still exists, the client
resolves a five-minute signed preview URL under the user's existing Storage
permissions. The URL stays in memory and no image access is made public.

The change improves fidelity to the photographed pixels, not proof that those
pixels or AI estimates equal water chemistry. Static checks only; no trial
scans, new provider requests, image-processing replays or test suites were run.

Normally `AGENTS.md` forbids tests and paid validation. On 2026-10-13 the owner
explicitly requested grading the ten previously selected photos, sending them
to the model, comparing answers and fixing failures. That request authorized
this scoped audit only: ten baseline attempts (nine responses, one response
lost), ten updated model responses, and replay of those saved responses against
the final guards without further provider calls. No historical readings or
user quotas were changed and no broader/synthetic paid testing was performed.
Subjective photo comparisons cannot establish chemical ground truth.
