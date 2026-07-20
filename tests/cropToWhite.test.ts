import { describe, expect, it } from "vitest";
import { addCropSafetyMargin } from "../src/utils/cropToWhite";

describe("addCropSafetyMargin", () => {
  it("adds natural context around a tight strip crop", () => {
    const manualCrop = { x: 0.47, y: 0.2, w: 0.06, h: 0.6 };
    const expanded = addCropSafetyMargin(manualCrop);

    expect(expanded.x).toBeCloseTo(0.458);
    expect(expanded.y).toBeCloseTo(0.182);
    expect(expanded.w).toBeCloseTo(0.084);
    expect(expanded.h).toBeCloseTo(0.636);
    expect(manualCrop.x - expanded.x).toBeCloseTo(manualCrop.w * 0.2);
    expect(expanded.x + expanded.w - (manualCrop.x + manualCrop.w)).toBeCloseTo(
      manualCrop.w * 0.2,
    );
  });

  it("keeps a minimum horizontal margin for extremely narrow crops", () => {
    const expanded = addCropSafetyMargin({ x: 0.499, y: 0.2, w: 0.002, h: 0.6 });

    expect(expanded.w).toBeCloseTo(0.014);
    expect(expanded.x).toBeCloseTo(0.493);
  });

  it("stays within the original image near its edges", () => {
    expect(addCropSafetyMargin({ x: 0, y: 0, w: 0.1, h: 0.5 })).toEqual({
      x: 0,
      y: 0,
      w: 0.14,
      h: 0.53,
    });

    const bottomRight = addCropSafetyMargin({ x: 0.9, y: 0.8, w: 0.1, h: 0.2 });
    expect(bottomRight.x + bottomRight.w).toBeCloseTo(1);
    expect(bottomRight.y + bottomRight.h).toBeCloseTo(1);
  });
});
