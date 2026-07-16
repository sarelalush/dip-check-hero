import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LineIcon } from '../components/LineIcon';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import { useScanSession } from '../state/ScanSessionContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'CropScanImage'>;

type Size = {
  height: number;
  width: number;
};

type CropBox = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type RenderedImage = CropBox & {
  scale: number;
};

const POOL_BACKGROUND = require('../../assets/images/home-pool.png');
const MIN_CROP_HEIGHT = 170;
const MIN_CROP_WIDTH = 38;
const CROP_PADDING_RATIO = 0.01;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundCrop(crop: ImageManipulator.ActionCrop['crop'], image: Size): ImageManipulator.ActionCrop['crop'] {
  const originX = clamp(Math.round(crop.originX), 0, Math.max(0, image.width - 1));
  const originY = clamp(Math.round(crop.originY), 0, Math.max(0, image.height - 1));
  const width = clamp(Math.round(crop.width), 1, image.width - originX);
  const height = clamp(Math.round(crop.height), 1, image.height - originY);

  return { height, originX, originY, width };
}

function clampCrop(crop: CropBox, image: RenderedImage): CropBox {
  const width = clamp(crop.width, MIN_CROP_WIDTH, image.width);
  const height = clamp(crop.height, MIN_CROP_HEIGHT, image.height);
  const x = clamp(crop.x, 0, Math.max(0, image.width - width));
  const y = clamp(crop.y, 0, Math.max(0, image.height - height));

  return { height, width, x, y };
}

function computeRenderedImage(container: Size, image: Size): RenderedImage | null {
  if (!container.width || !container.height || !image.width || !image.height) return null;

  const scale = Math.min(container.width / image.width, container.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  return {
    height,
    scale,
    width,
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
  };
}

function createInitialCrop(image: RenderedImage): CropBox {
  const height = image.height * 0.82;
  const width = clamp(height * 0.2, MIN_CROP_WIDTH + 18, Math.min(110, image.width * 0.55));

  return clampCrop(
    {
      height,
      width,
      x: (image.width - width) / 2,
      y: (image.height - height) / 2,
    },
    image,
  );
}

export function CropScanImageScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { setCurrentStep, setImageUri, setScanError } = useScanSession();
  const imageUri = route.params.imageUri;
  const [imageSize, setImageSize] = useState<Size>({
    height: route.params.imageHeight ?? 0,
    width: route.params.imageWidth ?? 0,
  });
  const [containerSize, setContainerSize] = useState<Size>({ height: 0, width: 0 });
  const [crop, setCrop] = useState<CropBox | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('גרור את המסגרת כך שתכיל רק את הסטיק.');
  const gestureStart = useRef<CropBox | null>(null);

  const renderedImage = useMemo(() => computeRenderedImage(containerSize, imageSize), [containerSize, imageSize]);

  useEffect(() => {
    if (imageSize.width && imageSize.height) return;

    Image.getSize(
      imageUri,
      (width, height) => setImageSize({ height, width }),
      () => {
        setScanError({
          code: 'notDetected',
          message: 'לא הצלחנו לקרוא את גודל התמונה. נסה לבחור תמונה אחרת.',
        });
      },
    );
  }, [imageSize.height, imageSize.width, imageUri, setScanError]);

  useEffect(() => {
    if (!renderedImage || crop) return;
    setCrop(createInitialCrop(renderedImage));
  }, [crop, renderedImage]);

  const moveResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          gestureStart.current = crop;
        },
        onPanResponderMove: (_event, gesture) => {
          if (!renderedImage || !gestureStart.current) return;
          const next = {
            ...gestureStart.current,
            x: gestureStart.current.x + gesture.dx,
            y: gestureStart.current.y + gesture.dy,
          };
          setCrop(clampCrop(next, renderedImage));
        },
      }),
    [crop, renderedImage],
  );

  const resizeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          gestureStart.current = crop;
        },
        onPanResponderMove: (_event, gesture: PanResponderGestureState) => {
          if (!renderedImage || !gestureStart.current) return;
          const start = gestureStart.current;
          const next = {
            ...start,
            height: start.height + gesture.dy,
            width: start.width + gesture.dx,
          };
          setCrop(clampCrop(next, renderedImage));
        },
      }),
    [crop, renderedImage],
  );

  function onPreviewLayout(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout;
    setContainerSize({ height, width });
  }

  function resetCrop() {
    if (!renderedImage) return;
    setCrop(createInitialCrop(renderedImage));
    setMessage('המסגרת אופסה. מקם אותה סביב הסטיק בלבד.');
  }

  function validateCrop(current: CropBox) {
    if (current.height < MIN_CROP_HEIGHT || current.width < MIN_CROP_WIDTH) {
      return 'החיתוך קטן מדי. הגדל את המסגרת כך שכל הסטיק ייכנס.';
    }

    if (current.height / current.width < 2.8) {
      return 'המסגרת רחבה מדי. כוון אותה לצורה צרה ואנכית של סטיק.';
    }

    return undefined;
  }

  async function useCroppedImage() {
    if (!crop || !renderedImage || busy) return;

    const validationError = validateCrop(crop);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    try {
      setBusy(true);
      const padX = crop.width * CROP_PADDING_RATIO;
      const padY = crop.height * CROP_PADDING_RATIO;
      const imageCrop = roundCrop(
        {
          height: (crop.height + padY * 2) / renderedImage.scale,
          originX: (crop.x - padX) / renderedImage.scale,
          originY: (crop.y - padY) / renderedImage.scale,
          width: (crop.width + padX * 2) / renderedImage.scale,
        },
        imageSize,
      );

      const cropped = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop: imageCrop }],
        {
          compress: 0.98,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      const processingLog = [
        'source=gallery',
        `original=${imageSize.width}x${imageSize.height}`,
        `preview=${Math.round(containerSize.width)}x${Math.round(containerSize.height)}`,
        `rendered=${Math.round(renderedImage.x)},${Math.round(renderedImage.y)},${Math.round(renderedImage.width)}x${Math.round(renderedImage.height)}`,
        `manualCrop=${Math.round(crop.x)},${Math.round(crop.y)},${Math.round(crop.width)}x${Math.round(crop.height)}`,
        `imageCrop=${imageCrop.originX},${imageCrop.originY},${imageCrop.width}x${imageCrop.height}`,
        `final=${cropped.width}x${cropped.height}`,
      ];

      for (const line of processingLog) {
        console.info(`[gallery-strip-crop] ${line}`);
      }

      setImageUri(cropped.uri, {
        originalImageUri: imageUri,
        processingLog,
      });
      setCurrentStep('confirm');
      navigation.replace('ConfirmScan', {
        brandId: route.params.brandId,
        imageUri: cropped.uri,
        poolId: route.params.poolId,
      });
    } catch (error) {
      console.warn('[gallery-strip-crop] failed', error);
      setMessage('לא הצלחנו לחתוך את התמונה. נסה לכוון שוב את המסגרת.');
      setScanError({
        code: 'processingFailed',
        message: 'לא הצלחנו לחתוך את התמונה. נסה לכוון שוב את המסגרת או לבחור תמונה אחרת.',
      });
    } finally {
      setBusy(false);
    }
  }

  const cropAbsolute = crop && renderedImage
    ? {
        height: crop.height,
        width: crop.width,
        x: renderedImage.x + crop.x,
        y: renderedImage.y + crop.y,
      }
    : null;

  return (
    <View style={styles.root}>
      <ImageBackground source={POOL_BACKGROUND} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <View style={styles.backgroundWash} />
      </ImageBackground>

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
          <LineIcon name="close" color={colors.white} size={24} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.brand}>AquaSense</Text>
          <Text style={styles.title}>חתוך את הסטיק</Text>
          <Text style={styles.subtitle}>כוון את המסגרת כך שתישאר רק בדיקת הצבע.</Text>
        </View>
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom + 16, paddingTop: insets.top + 146 }]}>
        <View style={styles.previewShell}>
          <View style={styles.preview} onLayout={onPreviewLayout}>
            {renderedImage ? (
              <Image
                resizeMode="contain"
                source={{ uri: imageUri }}
                style={[
                  styles.previewImage,
                  {
                    height: renderedImage.height,
                    left: renderedImage.x,
                    top: renderedImage.y,
                    width: renderedImage.width,
                  },
                ]}
              />
            ) : (
              <ActivityIndicator color={colors.primary} size="large" />
            )}

            {cropAbsolute ? (
              <>
                <View style={[styles.dim, { bottom: containerSize.height - cropAbsolute.y, left: 0, right: 0, top: 0 }]} />
                <View style={[styles.dim, { bottom: 0, left: 0, right: 0, top: cropAbsolute.y + cropAbsolute.height }]} />
                <View style={[styles.dim, { height: cropAbsolute.height, left: 0, top: cropAbsolute.y, width: cropAbsolute.x }]} />
                <View
                  style={[
                    styles.dim,
                    {
                      height: cropAbsolute.height,
                      left: cropAbsolute.x + cropAbsolute.width,
                      right: 0,
                      top: cropAbsolute.y,
                    },
                  ]}
                />
                <View
                  {...moveResponder.panHandlers}
                  style={[
                    styles.cropBox,
                    {
                      height: cropAbsolute.height,
                      left: cropAbsolute.x,
                      top: cropAbsolute.y,
                      width: cropAbsolute.width,
                    },
                  ]}
                >
                  <Text style={styles.cropHint}>גרור</Text>
                  <View {...resizeResponder.panHandlers} style={styles.resizeHandle}>
                    <LineIcon name="plus" color={colors.white} size={15} />
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.quickActions}>
            <Pressable onPress={resetCrop} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>אפס מסגרת</Text>
            </Pressable>
            <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>בחר תמונה אחרת</Text>
            </Pressable>
          </View>
          <PrimaryButton busy={busy} disabled={!crop || !renderedImage} icon="check" label="השתמש בתמונה" onPress={useCroppedImage} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  backgroundWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(232,250,253,0.62)',
  },
  header: {
    left: 0,
    paddingHorizontal: spacing.lg,
    position: 'absolute',
    right: 0,
    zIndex: 5,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(6,30,42,0.42)',
    borderColor: 'rgba(255,255,255,0.38)',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.lg,
    top: 12,
    width: 48,
    zIndex: 6,
  },
  headerText: {
    alignItems: 'center',
  },
  brand: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
    fontSize: 26,
    fontWeight: '900',
    textShadowColor: 'rgba(255,255,255,0.92)',
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 10,
    ...rtl.textCenter,
  },
  title: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilyBold,
    fontSize: 31,
    fontWeight: '900',
    marginTop: spacing.xs,
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 12,
    ...rtl.textCenter,
  },
  subtitle: {
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 8,
    ...rtl.textCenter,
  },
  body: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  previewShell: {
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderColor: colors.borderStrong,
    borderRadius: radius.xl,
    borderWidth: 1,
    flex: 1,
    minHeight: 330,
    overflow: 'hidden',
    ...shadows.card,
  },
  preview: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    position: 'absolute',
  },
  dim: {
    backgroundColor: 'rgba(6,24,32,0.58)',
    position: 'absolute',
  },
  cropBox: {
    alignItems: 'center',
    borderColor: colors.primaryLight,
    borderRadius: 18,
    borderWidth: 3,
    justifyContent: 'center',
    position: 'absolute',
  },
  cropHint: {
    backgroundColor: 'rgba(8,175,203,0.9)',
    borderRadius: radius.round,
    color: colors.white,
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    ...rtl.textCenter,
  },
  resizeHandle: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.white,
    borderRadius: 18,
    borderWidth: 2,
    bottom: -18,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: -18,
    width: 36,
  },
  panel: {
    backgroundColor: colors.cardSoft,
    borderColor: colors.borderStrong,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.card,
  },
  message: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 22,
    ...rtl.textCenter,
  },
  quickActions: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.borderStrong,
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  secondaryText: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});
