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
Normally `AGENTS.md` forbids tests and paid validation. On 2026-10-13 the owner
explicitly requested grading the ten previously selected photos, sending them
to the model, comparing answers and fixing failures. That request authorized
this scoped audit only: ten baseline attempts (nine responses, one response
lost), ten updated model responses, and replay of those saved responses against
the final guards without further provider calls. No historical readings or
user quotas were changed and no broader/synthetic paid testing was performed.
Subjective photo comparisons cannot establish chemical ground truth.
