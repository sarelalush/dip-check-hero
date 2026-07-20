import { describe, expect, it } from "vitest";
import { addCropSafetyMargin } from "../src/utils/cropToWhite";

describe("addCropSafetyMargin", () => {
  it("adds natural context around a tight strip crop", () => {
    expect(addCropSafetyMargin({ x: 0.47, y: 0.2, w: 0.06, h: 0.6 })).toEqual({
      x: 0.461,
      y: 0.182,
      w: 0.078,
      h: 0.636,
    });
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
      w: 0.13,
      h: 0.53,
    });

    const bottomRight = addCropSafetyMargin({ x: 0.9, y: 0.8, w: 0.1, h: 0.2 });
    expect(bottomRight.x + bottomRight.w).toBeCloseTo(1);
    expect(bottomRight.y + bottomRight.h).toBeCloseTo(1);
  });
});
