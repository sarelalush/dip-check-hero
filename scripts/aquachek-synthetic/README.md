# AquaChek Pro synthetic validation

This harness renders every discrete AquaChek Pro 5-in-1 chart combination and
evaluates it with the same reference table and color matcher used by the
Supabase `analyze-strip` Edge Function.

## Commands

```bash
npm run generate:aquachek-fixtures
npm run evaluate:aquachek-fixtures
npm run test:aquachek
```

Generated images, `manifest.json`, `canonical-states.csv`, contact sheets, and
machine-readable reports are written to `work/aquachek-synthetic-dataset/` and
are intentionally ignored by Git. The CSV is the compact database of all 1,260
legal chart states. The latest compact report is copied to
`docs/aquachek-synthetic-latest-report.md`.

## Dataset tiers

- `canonical`: exact manufacturer chart colors.
- `controlled`: mild exposure and white-balance shifts.
- `geometry`: small strip rotations while retaining the production sample area.
- `invalid`: images that an end-to-end AI quality gate must reject.

The combined contact sheet contains 19 valid examples followed by all six
invalid examples. Separate `contact-sheet-valid.png` and
`contact-sheet-invalid.png` files make visual review easier.

The four physical pads are rendered in wet-tip-to-handle order. The first pad
represents both total chlorine and total bromine, so those values are linked.
There are 1,260 legal combinations, not an independent chlorine x bromine
Cartesian product.

## What this does not prove

Synthetic fixtures test mapping, regression safety, and controlled color
robustness. They do not replace a held-out real-photo dataset labelled by a
photometer or drop kit. A 99% production claim must be measured on that real
dataset, separately by strip lot, phone model, lighting condition, and each
chemical parameter.
