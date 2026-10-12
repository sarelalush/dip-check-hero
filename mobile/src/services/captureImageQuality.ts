import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import type { ImageQualityReport } from '../domain/captureQuality';

function decodeBase64(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = value.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 6) / 8));
  let accumulator = 0;
  let bits = 0;
  let offset = 0;
  for (const char of clean) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) continue;
    accumulator = (accumulator << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[offset++] = (accumulator >> bits) & 255;
    }
  }
  return bytes.subarray(0, offset);
}

// A bounded thumbnail is inspected locally. Never change the image sent for
// reading: no white-balance correction, sharpening, denoising or color filters.
// These conservative heuristics are capture hints, not a calibrated strip detector.
export async function inspectCaptureImage(uri: string): Promise<ImageQualityReport> {
  let width = 0;
  let height = 0;
  try {
    const original = await ImageManipulator.manipulateAsync(uri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
      compress: 1,
    });
    width = original.width;
    height = original.height;
    const scale = Math.min(1, 640 / Math.max(width, height));
    const thumbnail = await ImageManipulator.manipulateAsync(
      original.uri,
      [
        {
          resize: {
            width: Math.max(1, Math.round(width * scale)),
            height: Math.max(1, Math.round(height * scale)),
          },
        },
      ],
      { format: ImageManipulator.SaveFormat.JPEG, compress: 1, base64: true },
    );
    if (!thumbnail.base64) throw new Error('No image data');
    const pixels = decode(decodeBase64(thumbnail.base64), {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 1,
      maxMemoryUsageInMB: 24,
    });
    const luminance = new Float32Array(pixels.width * pixels.height);
    let sum = 0;
    let dark = 0;
    let clipped = 0;
    for (let i = 0; i < luminance.length; i++) {
      const r = pixels.data[i * 4];
      const g = pixels.data[i * 4 + 1];
      const b = pixels.data[i * 4 + 2];
      const light = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      luminance[i] = light;
      sum += light;
      if (light < 25) dark++;
      if (r >= 250 && g >= 250 && b >= 250) clipped++;
    }
    let energy = 0;
    let count = 0;
    for (let y = 1; y < pixels.height - 1; y++) {
      for (let x = 1; x < pixels.width - 1; x++) {
        const i = y * pixels.width + x;
        const laplacian =
          luminance[i - 1] +
          luminance[i + 1] +
          luminance[i - pixels.width] +
          luminance[i + pixels.width] -
          4 * luminance[i];
        energy += laplacian * laplacian;
        count++;
      }
    }
    const meanLuminance = sum / luminance.length;
    const darkFraction = dark / luminance.length;
    const clippedFraction = clipped / luminance.length;
    const edgeEnergy = energy / Math.max(1, count);
    const warnings: string[] = [];
    const blockers: string[] = [];
    if (Math.max(width, height) < 420 || Math.min(width, height) < 55) {
      blockers.push('התמונה קטנה מדי לקריאת ריבועי הצבע. צלם תמונה חדשה ברזולוציה מלאה.');
    }
    if (darkFraction > 0.92 || meanLuminance < 12) {
      blockers.push('התמונה חשוכה מאוד. עבור למקום מואר באור אחיד וצלם שוב.');
    } else if (darkFraction > 0.4 || meanLuminance < 55) {
      warnings.push('ייתכן שהתמונה חשוכה או מוצלת. ודא שכל ריבועי הצבע מוארים באופן אחיד.');
    }
    // A white carrier/background can legitimately clip. Only an almost
    // entirely white image is blocked; localized glare requires human review.
    if (clippedFraction > 0.98)
      blockers.push('כמעט כל התמונה לבנה ללא פרטים. הפחת תאורה ישירה וצלם שוב.');
    else if (clippedFraction > 0.45)
      warnings.push('יש אזורים לבנים מאוד. ודא שאין השתקפות שמסתירה צבע על אחד הריבועים.');
    if (edgeEnergy < 10)
      warnings.push('ייתכן שהצילום רך או מטושטש. הגדל את התצוגה וודא שקצוות הריבועים חדים.');
    if (Math.max(width, height) / Math.min(width, height) < 2.5)
      warnings.push('החיתוך כולל רקע רב. ודא שנראה סטיק אחד שלם ושכל ריבועי הצבע גדולים וברורים.');
    return {
      version: 'capture-quality-v1',
      status: blockers.length ? 'blocked' : 'checked',
      width,
      height,
      warnings,
      blockers,
      meanLuminance,
      darkFraction,
      clippedFraction,
      edgeEnergy,
    };
  } catch {
    return {
      version: 'capture-quality-v1',
      status: 'unavailable',
      width,
      height,
      blockers: [],
      warnings: [
        'הבדיקה המקומית לא זמינה לתמונה הזו. בדוק ידנית חדות, תאורה ושלמות הסטיק לפני ההמשך.',
      ],
    };
  }
}
