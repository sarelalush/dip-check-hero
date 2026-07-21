import { beforeEach, describe, expect, it, vi } from "vitest";

const { analyzeMock } = vi.hoisted(() => ({
  analyzeMock: vi.fn(),
}));

vi.mock("@/lib/strip-analysis.functions", () => ({
  analyzeStripWithAI: analyzeMock,
}));

import { analyzeStripImage, StripNotDetectedError } from "./analyzeStripImage";

describe("single-call strip analysis", () => {
  beforeEach(() => {
    analyzeMock.mockReset();
  });

  it("sends the original image to Gemini exactly once and returns its values unchanged", async () => {
    analyzeMock.mockResolvedValue({
      ok: true,
      data: {
        isStrip: true,
        failureReason: "none",
        values: {
          totalChlorine: 3,
          bromine: 5,
          freeChlorine: 4,
          ph: 7.8,
          alkalinity: 240,
        },
        confidence: 0.86,
        notes: "קריאה תקינה",
      },
    });

    const image = "data:image/jpeg;base64,original-image";
    const result = await analyzeStripImage(image, "aquachek-pro-5in1");

    expect(analyzeMock).toHaveBeenCalledTimes(1);
    expect(analyzeMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ imageBase64: image }),
    });
    expect(result.readings.totalChlorine?.value).toBe(3);
    expect(result.readings.bromine?.value).toBe(5);
    expect(result.readings.freeChlorine?.value).toBe(4);
    expect(result.readings.ph?.value).toBe(7.8);
    expect(result.readings.alkalinity?.value).toBe(240);
    expect(result.confidence).toBe(0.86);
    expect(result.shotsUsed).toBe(1);
    expect(result.source).toBe("ai");
  });

  it("shows Gemini's rejection without running a fallback analysis", async () => {
    analyzeMock.mockResolvedValue({
      ok: true,
      data: {
        isStrip: false,
        failureReason: "not_strip",
        values: {},
        confidence: 0,
        notes: "לא זוהה סטיק בדיקה בתמונה.",
      },
    });

    await expect(
      analyzeStripImage("data:image/jpeg;base64,person-photo", "aquachek-pro-5in1"),
    ).rejects.toMatchObject<Partial<StripNotDetectedError>>({
      reason: "not_strip",
      message: "לא זוהה סטיק בדיקה בתמונה.",
    });
    expect(analyzeMock).toHaveBeenCalledTimes(1);
  });

  it("does not change or calibrate Gemini's pH value", async () => {
    analyzeMock.mockResolvedValue({
      ok: true,
      data: {
        isStrip: true,
        failureReason: "none",
        values: {
          totalChlorine: 1,
          bromine: 2,
          freeChlorine: 1,
          ph: 7.8,
          alkalinity: 80,
        },
        confidence: 0.8,
        notes: "",
      },
    });

    const result = await analyzeStripImage(
      "data:image/jpeg;base64,strip-image",
      "aquachek-pro-5in1",
    );

    expect(result.readings.ph?.value).toBe(7.8);
    expect(analyzeMock).toHaveBeenCalledTimes(1);
  });
});
