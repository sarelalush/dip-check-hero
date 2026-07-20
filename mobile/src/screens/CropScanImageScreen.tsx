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

type ResizeHandle = 'topLeft' | 'top' | 'topRight' | 'right' | 'bottomRight' | 'bottom' | 'bottomLeft' | 'left';

const POOL_BACKGROUND = require('../../assets/images/home-pool.png');
const MIN_CROP_WIDTH = 4;
const MIN_CROP_HEIGHT = 20;
const CROP_NUDGE = 2;
const CROP_HORIZONTAL_PADDING_RATIO = 0.2;
const CROP_VERTICAL_PADDING_RATIO = 0.03;
const MIN_CROP_HORIZONTAL_PADDING = 3;
const MIN_CROP_VERTICAL_PADDING = 2;

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

function addCropSafetyMargin(crop: CropBox, image: RenderedImage): CropBox {
  const padX = Math.max(crop.width * CROP_HORIZONTAL_PADDING_RATIO, MIN_CROP_HORIZONTAL_PADDING);
  const padY = Math.max(crop.height * CROP_VERTICAL_PADDING_RATIO, MIN_CROP_VERTICAL_PADDING);
  const left = clamp(crop.x - padX, 0, image.width);
  const top = clamp(crop.y - padY, 0, image.height);
  const right = clamp(crop.x + crop.width + padX, 0, image.width);
  const bottom = clamp(crop.y + crop.height + padY, 0, image.height);

  return {
    height: Math.max(1, bottom - top),
    width: Math.max(1, right - left),
    x: left,
    y: top,
  };
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
  const width = image.width * 0.2;
  const height = image.height * 0.78;

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

function resizeCrop(
  start: CropBox,
  gesture: PanResponderGestureState,
  handle: ResizeHandle,
  image: RenderedImage,
): CropBox {
  const resizingLeft = handle === 'left' || handle === 'topLeft' || handle === 'bottomLeft';
  const resizingRight = handle === 'right' || handle === 'topRight' || handle === 'bottomRight';
  const resizingTop = handle === 'top' || handle === 'topLeft' || handle === 'topRight';
  const resizingBottom = handle === 'bottom' || handle === 'bottomLeft' || handle === 'bottomRight';
  let nextX = start.x;
  let nextY = start.y;
  let nextWidth = start.width;
  let nextHeight = start.height;

  if (resizingLeft) {
    nextX = start.x + gesture.dx;
    nextWidth = start.width - gesture.dx;
  }

  if (resizingRight) {
    nextWidth = start.width + gesture.dx;
  }

  if (resizingTop) {
    nextY = start.y + gesture.dy;
    nextHeight = start.height - gesture.dy;
  }

  if (resizingBottom) {
    nextHeight = start.height + gesture.dy;
  }

  if (nextWidth < MIN_CROP_WIDTH) {
    if (resizingLeft) {
      nextX = start.x + start.width - MIN_CROP_WIDTH;
    }
    nextWidth = MIN_CROP_WIDTH;
  }

  if (nextHeight < MIN_CROP_HEIGHT) {
    if (resizingTop) {
      nextY = start.y + start.height - MIN_CROP_HEIGHT;
    }
    nextHeight = MIN_CROP_HEIGHT;
  }

  if (nextX < 0) {
    nextWidth += nextX;
    nextX = 0;
  }

  if (nextY < 0) {
    nextHeight += nextY;
    nextY = 0;
  }

  if (nextX + nextWidth > image.width) {
    nextWidth = image.width - nextX;
  }

  if (nextY + nextHeight > image.height) {
    nextHeight = image.height - nextY;
  }

  return clampCrop({ height: nextHeight, width: nextWidth, x: nextX, y: nextY }, image);
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
  const [message, setMessage] = useState('סמן את כל הסטיק. נשמור אוטומטית 20% מרווח מכל צד.');
  const gestureStart = useRef<CropBox | null>(null);
  const activeHandleRef = useRef<ResizeHandle | null>(null);
  const cropRef = useRef<CropBox | null>(null);
  const renderedImageRef = useRef<RenderedImage | null>(null);

  const renderedImage = useMemo(() => computeRenderedImage(containerSize, imageSize), [containerSize, imageSize]);

  useEffect(() => {
    cropRef.current = crop;
  }, [crop]);

  useEffect(() => {
    renderedImageRef.current = renderedImage;
  }, [renderedImage]);

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
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => activeHandleRef.current === null,
        onStartShouldSetPanResponder: () => activeHandleRef.current === null,
        onPanResponderGrant: () => {
          gestureStart.current = cropRef.current;
        },
        onPanResponderMove: (_event, gesture) => {
          const image = renderedImageRef.current;
          if (!image || !gestureStart.current) return;
          const next = {
            ...gestureStart.current,
            x: gestureStart.current.x + gesture.dx,
            y: gestureStart.current.y + gesture.dy,
          };
          setCrop(clampCrop(next, image));
        },
        onPanResponderRelease: () => {
          gestureStart.current = null;
        },
        onPanResponderTerminate: () => {
          gestureStart.current = null;
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  const resizeResponders = useMemo(() => {
    const handles: ResizeHandle[] = [
      'topLeft',
      'top',
      'topRight',
      'right',
      'bottomRight',
      'bottom',
      'bottomLeft',
      'left',
    ];
    return handles.reduce(
      (responders, handle) => {
        responders[handle] = PanResponder.create({
          onMoveShouldSetPanResponderCapture: () => true,
          onMoveShouldSetPanResponder: () => true,
          onStartShouldSetPanResponderCapture: () => true,
          onStartShouldSetPanResponder: () => true,
          onPanResponderGrant: () => {
            activeHandleRef.current = handle;
            gestureStart.current = cropRef.current;
          },
          onPanResponderMove: (_event, gesture) => {
            const image = renderedImageRef.current;
            if (!image || !gestureStart.current) return;
            setCrop(resizeCrop(gestureStart.current, gesture, handle, image));
          },
          onPanResponderRelease: () => {
            activeHandleRef.current = null;
            gestureStart.current = null;
          },
          onPanResponderTerminate: () => {
            activeHandleRef.current = null;
            gestureStart.current = null;
          },
          onPanResponderTerminationRequest: () => false,
        });
        return responders;
      },
      {} as Record<ResizeHandle, ReturnType<typeof PanResponder.create>>,
    );
  }, []);

  function onPreviewLayout(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout;
    setContainerSize({ height, width });
  }

  function resetCrop() {
    if (!renderedImage) return;
    setCrop(createInitialCrop(renderedImage));
    setMessage('החיתוך אופס. סמן את כל הסטיק; נשמור 20% מרווח מכל צד.');
  }

  function adjustCropDimension(axis: 'height' | 'width', direction: -1 | 1) {
    const image = renderedImageRef.current;
    const current = cropRef.current;
    if (!image || !current) return;

    const delta = CROP_NUDGE * direction;
    const nextSize =
      axis === 'width'
        ? clamp(current.width + delta, MIN_CROP_WIDTH, image.width)
        : clamp(current.height + delta, MIN_CROP_HEIGHT, image.height);
    const sizeDelta = nextSize - current[axis];

    setCrop(
      clampCrop(
        axis === 'width'
          ? { ...current, width: nextSize, x: current.x - sizeDelta / 2 }
          : { ...current, height: nextSize, y: current.y - sizeDelta / 2 },
        image,
      ),
    );
  }

  function validateCrop(current: CropBox) {
    if (current.height < MIN_CROP_HEIGHT || current.width < MIN_CROP_WIDTH) {
      return 'החיתוך קטן מדי. הגדל את האזור כך שכל הסטיק ייכנס.';
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
      const safeCrop = addCropSafetyMargin(crop, renderedImage);
      const imageCrop = roundCrop(
        {
          height: safeCrop.height / renderedImage.scale,
          originX: safeCrop.x / renderedImage.scale,
          originY: safeCrop.y / renderedImage.scale,
          width: safeCrop.width / renderedImage.scale,
        },
        imageSize,
      );

      const cropped = await ImageManipulator.manipulateAsync(imageUri, [{ crop: imageCrop }], {
        compress: 0.98,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      const processingLog = [
        'source=gallery',
        `original=${imageSize.width}x${imageSize.height}`,
        `preview=${Math.round(containerSize.width)}x${Math.round(containerSize.height)}`,
        `rendered=${Math.round(renderedImage.x)},${Math.round(renderedImage.y)},${Math.round(renderedImage.width)}x${Math.round(renderedImage.height)}`,
        `manualCrop=${Math.round(crop.x)},${Math.round(crop.y)},${Math.round(crop.width)}x${Math.round(crop.height)}`,
        `safeCrop=${Math.round(safeCrop.x)},${Math.round(safeCrop.y)},${Math.round(safeCrop.width)}x${Math.round(safeCrop.height)}`,
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

  const cropAbsolute =
    crop && renderedImage
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
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <LineIcon name="close" color={colors.white} size={24} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.brand}>AquaSense</Text>
          <Text style={styles.title}>חתוך את התמונה</Text>
          <Text style={styles.subtitle}>גרור את הפינות סביב הסטיק. החיתוך הסופי ישמור 20% מרווח מכל צד.</Text>
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
                <View
                  style={[styles.dim, { bottom: containerSize.height - cropAbsolute.y, left: 0, right: 0, top: 0 }]}
                />
                <View
                  style={[styles.dim, { bottom: 0, left: 0, right: 0, top: cropAbsolute.y + cropAbsolute.height }]}
                />
                <View
                  style={[
                    styles.dim,
                    {
                      height: cropAbsolute.height,
                      left: 0,
                      top: cropAbsolute.y,
                      width: cropAbsolute.x,
                    },
                  ]}
                />
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
                  <View {...moveResponder.panHandlers} style={styles.moveArea} />
                  <View {...resizeResponders.topLeft.panHandlers} style={[styles.cornerHandle, styles.topLeftHandle]} />
                  <View
                    {...resizeResponders.topRight.panHandlers}
                    style={[styles.cornerHandle, styles.topRightHandle]}
                  />
                  <View
                    {...resizeResponders.bottomRight.panHandlers}
                    style={[styles.cornerHandle, styles.bottomRightHandle]}
                  />
                  <View
                    {...resizeResponders.bottomLeft.panHandlers}
                    style={[styles.cornerHandle, styles.bottomLeftHandle]}
                  />
                  <View {...resizeResponders.top.panHandlers} style={[styles.edgeHandle, styles.topHandle]} />
                  <View {...resizeResponders.right.panHandlers} style={[styles.edgeHandle, styles.rightHandle]} />
                  <View {...resizeResponders.bottom.panHandlers} style={[styles.edgeHandle, styles.bottomHandle]} />
                  <View {...resizeResponders.left.panHandlers} style={[styles.edgeHandle, styles.leftHandle]} />
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.dimensionControls}>
            <DimensionControl
              label="רוחב"
              onDecrease={() => adjustCropDimension('width', -1)}
              onIncrease={() => adjustCropDimension('width', 1)}
              value={crop && renderedImage ? Math.round((crop.width / renderedImage.width) * 100) : 0}
            />
            <DimensionControl
              label="גובה"
              onDecrease={() => adjustCropDimension('height', -1)}
              onIncrease={() => adjustCropDimension('height', 1)}
              value={crop && renderedImage ? Math.round((crop.height / renderedImage.height) * 100) : 0}
            />
          </View>
          <View style={styles.quickActions}>
            <Pressable onPress={resetCrop} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>אפס מסגרת</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>בחר תמונה אחרת</Text>
            </Pressable>
          </View>
          <PrimaryButton
            busy={busy}
            disabled={!crop || !renderedImage}
            icon="check"
            label="השתמש בתמונה"
            onPress={useCroppedImage}
          />
        </View>
      </View>
    </View>
  );
}

function DimensionControl({
  label,
  onDecrease,
  onIncrease,
  value,
}: {
  label: string;
  onDecrease: () => void;
  onIncrease: () => void;
  value: number;
}) {
  return (
    <View style={styles.dimensionControl}>
      <Text style={styles.dimensionLabel}>{label}</Text>
      <View style={styles.dimensionActions}>
        <Pressable
          accessibilityLabel={`הקטן ${label}`}
          onPress={onDecrease}
          style={({ pressed }) => [styles.dimensionButton, pressed && styles.pressed]}
        >
          <Text style={styles.dimensionButtonText}>−</Text>
        </Pressable>
        <Text style={styles.dimensionValue}>{value}%</Text>
        <Pressable
          accessibilityLabel={`הגדל ${label}`}
          onPress={onIncrease}
          style={({ pressed }) => [styles.dimensionButton, pressed && styles.pressed]}
        >
          <Text style={styles.dimensionButtonText}>+</Text>
        </Pressable>
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
    borderRadius: 8,
    borderWidth: 3,
    justifyContent: 'center',
    position: 'absolute',
  },
  moveArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  cornerHandle: {
    backgroundColor: colors.primary,
    borderColor: colors.white,
    borderRadius: 13,
    borderWidth: 3,
    height: 26,
    position: 'absolute',
    width: 26,
    zIndex: 10,
  },
  topLeftHandle: {
    left: -14,
    top: -14,
  },
  topRightHandle: {
    right: -14,
    top: -14,
  },
  bottomRightHandle: {
    bottom: -14,
    right: -14,
  },
  bottomLeftHandle: {
    bottom: -14,
    left: -14,
  },
  edgeHandle: {
    backgroundColor: colors.white,
    borderColor: colors.primary,
    borderRadius: 13,
    borderWidth: 3,
    position: 'absolute',
    zIndex: 10,
  },
  topHandle: {
    height: 24,
    left: '38%',
    right: '38%',
    top: -13,
  },
  rightHandle: {
    bottom: '38%',
    right: -13,
    top: '38%',
    width: 24,
  },
  bottomHandle: {
    bottom: -13,
    height: 24,
    left: '38%',
    right: '38%',
  },
  leftHandle: {
    bottom: '38%',
    left: -13,
    top: '38%',
    width: 24,
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
  dimensionControls: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
  dimensionControl: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  dimensionLabel: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  dimensionActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dimensionButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dimensionButtonText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  dimensionValue: {
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 34,
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
