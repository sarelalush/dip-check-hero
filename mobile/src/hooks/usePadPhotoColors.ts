import { useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';
import { getPadColor, type PadColor } from '../domain/padColor';
import type { StripAnalysisResult } from '../domain/scanResults';
import type { StripParameter } from '../domain/strip';
import { getSignedScanImagePreviewUrl } from '../services/scanImageStorage';

function loadImageSize(uri: string): Promise<{ width: number; height: number } | undefined> {
  return new Promise(resolve => Image.getSize(uri, (width, height) => {
    resolve(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
      ? { width, height } : undefined);
  }, () => resolve(undefined)));
}

export function usePadPhotoColors(result?: StripAnalysisResult | null): Partial<Record<StripParameter, PadColor>> {
  const uri = result?.imageUri || result?.imageUrl;
  const imagePath = result?.imagePath;
  const [loadedImage, setLoadedImage] = useState<{
    uri: string; originalUri?: string; imagePath?: string; width: number; height: number;
  }>();
  useEffect(() => {
    let active = true;
    void (async () => {
      let sourceUri = uri;
      let size = sourceUri ? await loadImageSize(sourceUri) : undefined;
      if (!size && active && imagePath) {
        sourceUri = await getSignedScanImagePreviewUrl(imagePath);
        size = sourceUri && active ? await loadImageSize(sourceUri) : undefined;
      }
      if (active && sourceUri && size)
        setLoadedImage({ uri: sourceUri, originalUri: uri, imagePath, ...size });
    })().catch(() => { /* Keep the labelled fallback when the source is unavailable. */ });
    return () => { active = false; };
  }, [uri, imagePath]);
  return useMemo(() => {
    const palette: Partial<Record<StripParameter, PadColor>> = {};
    if (!result) return palette;
    const photoSize = loadedImage?.originalUri === uri && loadedImage?.imagePath === imagePath
      ? loadedImage : undefined;
    for (const parameter of result.parameters) {
      const color = getPadColor(result, parameter.key, photoSize);
      if (color) palette[parameter.key] = color;
    }
    return palette;
  }, [result, loadedImage, uri, imagePath]);
}
