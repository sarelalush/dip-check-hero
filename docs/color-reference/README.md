# AquaChek Pro color reference

The versioned source is `supabase/functions/_shared/aquachek-pro-chart.json`.
It is imported by the client swatches, display ranges and color matcher, and
copied to `strip_brands.color_chart` by a migration. The production Edge Function
loads one validated DB snapshot per request for the model prompt, discrete-value
checks, pixel comparison and cache identity.

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

One model request localizes and reads the four pads in physical wet-tip-to-handle
order. The server samples pad interiors, applies a bounded white-carrier
correction, and compares colors in CIELAB against the same snapshot. A returned
reading must be a listed level and agree with the model; TC/bromine must select
the same column. Missing/overlapping boxes, unclear structure, low focus,
off-chart colors and close competing levels are rejected with a concise Hebrew
recapture instruction. The result stores the reference revision, color evidence
and per-parameter confidence; rejection records retain available audit evidence.

The distance, separation, focus and confidence thresholds are heuristics.
Reference pixels alone cannot establish accuracy for camera exposure, lighting,
strip lot, read time or chemistry. Confidence is not a measured accuracy
percentage. Physical readings compared with a separate measurement method are
still needed to quantify accuracy.

No historical user results are overwritten or automatically reanalyzed.
No trial scans, test suites or paid-service validation calls were performed:
`AGENTS.md` forbids them. Only static compiler/code checks were used.
