// Minimal happy-dom canvas + Image mock backed by pngjs, just enough for
// analyzeStripPixels (drawImage + getImageData on a single PNG).
import { PNG } from "pngjs";

interface FakeImage {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  _png?: PNG;
  onload?: () => void;
  onerror?: () => void;
}

const pngStore = new Map<string, PNG>();

export function registerPng(dataUrl: string, png: PNG) {
  pngStore.set(dataUrl, png);
}

export function installCanvasMock() {
  // global Image
  class MockImage implements FakeImage {
    naturalWidth = 0;
    naturalHeight = 0;
    _png?: PNG;
    onload?: () => void;
    onerror?: () => void;
    private _src = "";
    set src(v: string) {
      this._src = v;
      const png = pngStore.get(v);
      queueMicrotask(() => {
        if (!png) {
          this.onerror?.();
          return;
        }
        this._png = png;
        this.naturalWidth = png.width;
        this.naturalHeight = png.height;
        this.onload?.();
      });
    }
    get src() {
      return this._src;
    }
  }
  (globalThis as any).Image = MockImage;

  // document.createElement('canvas') -> fake canvas using last drawn PNG
  const origCreate = document.createElement.bind(document);
  (document as any).createElement = (tag: string) => {
    if (tag !== "canvas") return origCreate(tag);
    let width = 0,
      height = 0,
      png: PNG | undefined;
    const ctx = {
      drawImage(img: FakeImage) {
        png = img._png;
      },
      getImageData(x: number, y: number, w: number, h: number) {
        const data = new Uint8ClampedArray(w * h * 4);
        if (!png) return { data, width: w, height: h };
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) {
            const sx = Math.max(0, Math.min(png.width - 1, Math.floor(x + i)));
            const sy = Math.max(0, Math.min(png.height - 1, Math.floor(y + j)));
            const sIdx = (sy * png.width + sx) * 4;
            const dIdx = (j * w + i) * 4;
            data[dIdx] = png.data[sIdx];
            data[dIdx + 1] = png.data[sIdx + 1];
            data[dIdx + 2] = png.data[sIdx + 2];
            data[dIdx + 3] = png.data[sIdx + 3];
          }
        }
        return { data, width: w, height: h };
      },
    };
    return {
      get width() {
        return width;
      },
      set width(v: number) {
        width = v;
      },
      get height() {
        return height;
      },
      set height(v: number) {
        height = v;
      },
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;
  };
}

/**
 * Build a synthetic vertical AquaChek Pro strip: 4 stacked solid-color pads
 * matching what analyzeStripPixels expects, top→bottom:
 *   [combined Total Chlorine + Bromine, Free Chlorine, pH, Total Alkalinity]
 */
export function makeStripFixture(opts: {
  id: string;
  tc?: [number, number, number];
  br?: [number, number, number];
  fc: [number, number, number];
  ph: [number, number, number];
  alk: [number, number, number];
  width?: number;
  height?: number;
}): string {
  const width = opts.width ?? 60;
  const height = opts.height ?? 400;
  const png = new PNG({ width, height });

  // Fill background light gray
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      png.data[i] = 230;
      png.data[i + 1] = 230;
      png.data[i + 2] = 230;
      png.data[i + 3] = 255;
    }
  }

  // Strip occupies middle 60% of height, divided into 4 pads
  const top = height * 0.2;
  const padH = (height * 0.6) / 4;
  // Default combined TC/TB pad to FC color when only legacy 3-pad opts are provided.
  const colors: [number, number, number][] = [
    opts.tc ?? opts.fc,
    opts.fc,
    opts.ph,
    opts.alk,
  ];
  for (let p = 0; p < 4; p++) {
    const y0 = Math.floor(top + p * padH);
    const y1 = Math.floor(top + (p + 1) * padH);
    const [r, g, b] = colors[p];
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        png.data[i] = r;
        png.data[i + 1] = g;
        png.data[i + 2] = b;
        png.data[i + 3] = 255;
      }
    }
  }

  const url = `mock://${opts.id}.png`;
  registerPng(url, png);
  return url;
}
