import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { PadColor } from '../domain/padColor';
import { colors, rtl, typography } from '../theme';

export function PadColorSwatch({ color, hidePhotoLabel = false }: { color?: PadColor; hidePhotoLabel?: boolean }) {
  const [loadedPreview, setLoadedPreview] = useState<{ uri: string; frame: string }>();
  const [failedPreview, setFailedPreview] = useState<{ uri: string; frame: string }>();
  const crop = color?.source === 'photo' ? color.crop : undefined;
  const frameKey = crop ? `${crop.centerX}|${crop.centerY}|${crop.side}|${crop.imageWidth}|${crop.imageHeight}` : '';
  const showPhoto = Boolean(crop && !(failedPreview?.uri === crop.uri && failedPreview.frame === frameKey));
  const loaded = Boolean(crop && loadedPreview?.uri === crop.uri && loadedPreview.frame === frameKey);
  const fallbackRgb = color?.source === 'reference' ? color.rgb : color?.referenceRgb;
  const label = showPhoto ? loaded ? 'מהצילום' : 'נטען' : fallbackRgb ? 'מקרא' : 'לא נשמר';
  const backgroundColor = !showPhoto && fallbackRgb
    ? `rgb(${fallbackRgb.map(channel => Math.round(channel)).join(',')})` : colors.backgroundSoft;
  const scale = crop ? 34 / crop.side : 1;
  return (
    <View style={styles.container} accessible accessibilityLabel={`דוגמית צבע: ${label}`}>
      <View style={[styles.swatch, { backgroundColor }]}>
        {showPhoto && crop ? (
          <View style={styles.photoViewport}>
            <Image key={frameKey} source={{ uri: crop.uri }} resizeMode="stretch" fadeDuration={0}
              accessible={false}
              onLoad={() => setLoadedPreview({ uri: crop.uri, frame: frameKey })}
              onError={() => setFailedPreview({ uri: crop.uri, frame: frameKey })}
              style={{ position: 'absolute', width: crop.imageWidth * scale, height: crop.imageHeight * scale,
                left: 17 - crop.centerX * scale, top: 17 - crop.centerY * scale, opacity: loaded ? 1 : 0 }} />
          </View>
        ) : !fallbackRgb ? <Text style={styles.missing}>—</Text> : null}
      </View>
      {!hidePhotoLabel || !showPhoto || !loaded ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 3 },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoViewport: { width: 34, height: 34, borderRadius: 7, overflow: 'hidden', direction: 'ltr' },
  label: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    ...rtl.textCenter,
  },
  missing: { color: colors.textSoft, ...rtl.textCenter },
});
