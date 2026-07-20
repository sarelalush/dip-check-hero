import { describe, expect, it, vi } from 'vitest';

import { readZeroBasedImageScriptRgb } from '../supabase/functions/_shared/imagescript-pixel.js';

describe('ImageScript pixel adapter', () => {
  it('converts zero-based CV coordinates to one-based ImageScript coordinates', () => {
    const getPixelAt = vi.fn((x: number, y: number) => x * 100 + y);
    const image = { width: 8, height: 12, getPixelAt };

    const rgb = readZeroBasedImageScriptRgb(image, (color: number) => [color, 2, 3], 0, 0);

    expect(getPixelAt).toHaveBeenCalledWith(1, 1);
    expect(rgb).toEqual([101, 2, 3]);
  });

  it('floors and clamps coordinates before reading the image', () => {
    const getPixelAt = vi.fn((x: number, y: number) => x * 100 + y);
    const image = { width: 8, height: 12, getPixelAt };

    readZeroBasedImageScriptRgb(image, (color: number) => [color, 0, 0], 99.8, -4.2);

    expect(getPixelAt).toHaveBeenCalledWith(8, 1);
  });

  it('rejects empty decoded images', () => {
    expect(() =>
      readZeroBasedImageScriptRgb(
        { width: 0, height: 0, getPixelAt: vi.fn() },
        (color: number) => [color, 0, 0],
        0,
        0,
      ),
    ).toThrow('Cannot read pixels from an empty image.');
  });
});
