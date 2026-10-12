import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LineIcon } from '../components/LineIcon';
import { WaterTexture } from '../components/WaterVisuals';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import { useAuth } from '../state/AuthContext';
import { useScanSession } from '../state/ScanSessionContext';
import {
  processTestStripImage,
  TestStripProcessingError,
  type TestStripFrame,
} from '../services/testStripImageProcessing';
import { canCreateScan, hasActiveSubscription } from '../services/usageService';
import type { RootStackParamList } from '../../App';
import { ScanPreparationSheet } from '../components/ScanPreparationSheet';
import type { CaptureMetadata } from '../domain/captureQuality';
import { STRIP_BRANDS } from '../config/stripBrands';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;
type ScanGateStatus = 'checking' | 'ready';

export function ScanScreen({ navigation, route }: Props) {
  const { accountId } = useAuth();
  const {
    ensureScanSession,
    resetScanSession,
    session,
    setCurrentStep,
    setImageUri,
    setScanError,
  } = useScanSession();
  const didInitializeSession = useRef(false);
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMessage, setCaptureMessage] = useState('מקם את הסטיק בתוך המסגרת ולחץ צילום');
  const [scanGateStatus, setScanGateStatus] = useState<ScanGateStatus>('checking');
  const [preparationOpen, setPreparationOpen] = useState(false);
  const [horizontalFrame, setHorizontalFrame] = useState(false);
  const [timing, setTiming] = useState<Omit<CaptureMetadata, 'source' | 'capturedAt'>>({
    timing: 'unknown',
  });
  const [now, setNow] = useState(Date.now());
  const isFocused = useIsFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );
  const captureLock = useRef(false);
  const operation = useRef<'camera' | 'gallery'>('camera');
  const captureVersion = useRef(0);
  const readAt =
    timing.dippedAt && timing.readDelaySeconds
      ? timing.dippedAt + timing.readDelaySeconds * 1000
      : undefined;
  const remaining = readAt ? Math.max(0, Math.ceil((readAt - now) / 1000)) : 0;
  const readyForCapture = timing.timing !== 'unknown' && remaining === 0;
  const { height: previewHeight, width: previewWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const activeBrandId = session.selectedBrandId ?? route.params?.brandId;

  const resultParams = useMemo(
    () => ({
      brandId: session.selectedBrandId ?? route.params?.brandId,
      poolId: session.selectedPoolId ?? route.params?.poolId,
    }),
    [route.params?.brandId, route.params?.poolId, session.selectedBrandId, session.selectedPoolId],
  );

  const scanFrame = useMemo<TestStripFrame>(() => {
    const availableHeight = Math.max(160, previewHeight - insets.top - insets.bottom - 350);
    const longSide = Math.min(previewHeight * 0.48, 500, availableHeight);
    const frameWidth = horizontalFrame
      ? previewWidth * 0.84
      : Math.max(42, Math.min(92, longSide * 0.17));
    const frameHeight = horizontalFrame ? Math.max(48, frameWidth * 0.17) : longSide;
    const preferredTop = previewHeight * 0.24;
    const minTop = insets.top + 132;
    const maxTop = previewHeight - frameHeight - insets.bottom - 208;
    const y = Math.max(
      minTop,
      Math.min(
        horizontalFrame ? minTop + (availableHeight - frameHeight) / 2 : preferredTop,
        maxTop,
      ),
    );
    const x = (previewWidth - frameWidth) / 2;

    return {
      height: frameHeight,
      previewHeight,
      previewWidth,
      width: frameWidth,
      x,
      y,
    };
  }, [horizontalFrame, insets.bottom, insets.top, previewHeight, previewWidth]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => {
      listener.remove();
      captureVersion.current++;
    };
  }, []);
  useEffect(() => {
    if (!isFocused || !foreground) {
      if (!isFocused || operation.current === 'camera') captureVersion.current++;
      if (!isFocused) setTiming({ timing: 'unknown' });
      setCameraReady(false);
    }
  }, [isFocused, foreground]);
  useEffect(() => {
    if (!isFocused || !readAt) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [isFocused, readAt]);

  useEffect(() => {
    if (didInitializeSession.current) return;
    didInitializeSession.current = true;

    if (!session.testId && (route.params?.brandId || route.params?.poolId)) {
      ensureScanSession({
        brandId: route.params?.brandId ?? session.selectedBrandId,
        poolId: route.params?.poolId ?? session.selectedPoolId,
      });
    }
  }, [
    route.params?.brandId,
    route.params?.poolId,
    session.selectedBrandId,
    session.selectedPoolId,
    session.testId,
    ensureScanSession,
  ]);

  useEffect(() => {
    if (STRIP_BRANDS.some((brand) => brand.id === activeBrandId && brand.supported)) return;

    setScanError({
      code: 'missingBrand',
      message: 'בחר סטיק נתמך לפני שמתחילים סריקה.',
    });
    navigation.replace(
      'SelectStrip',
      route.params?.poolId ? { poolId: route.params.poolId } : undefined,
    );
  }, [activeBrandId, navigation, route.params?.poolId, setScanError]);

  useEffect(() => {
    if (!activeBrandId) return;
    setCurrentStep('scan');
  }, [activeBrandId, setCurrentStep]);

  useEffect(() => {
    let cancelled = false;

    if (!activeBrandId) {
      return () => {
        cancelled = true;
      };
    }

    async function verifyScanAccess() {
      setScanGateStatus('checking');
      setScanError(undefined);

      if (!accountId) {
        navigation.replace('Purchase', { reason: 'subscriptionRequired' });
        return;
      }

      const subscribed = await hasActiveSubscription(accountId);
      if (cancelled) return;
      if (!subscribed) {
        navigation.replace('Purchase', { reason: 'subscriptionRequired' });
        return;
      }

      const allowed = await canCreateScan(accountId);
      if (cancelled) return;
      if (!allowed) {
        navigation.replace('Purchase', { reason: 'scanQuota' });
        return;
      }

      setScanGateStatus('ready');
    }

    void verifyScanAccess().catch(() => {
      if (!cancelled)
        setScanError({
          code: 'unknown',
          message: 'לא הצלחנו לבדוק את הגישה לסריקה. חזור ונסה שוב.',
        });
    });

    return () => {
      cancelled = true;
    };
  }, [accountId, activeBrandId, navigation, setScanError]);

  function closeScan() {
    captureVersion.current++;
    resetScanSession();
    navigation.navigate('Home');
  }

  async function captureStrip() {
    if (
      !cameraRef.current ||
      !cameraReady ||
      captureLock.current ||
      !isFocused ||
      !foreground ||
      !readyForCapture ||
      (readAt && Date.now() < readAt) ||
      scanGateStatus !== 'ready'
    ) {
      return;
    }

    captureLock.current = true;
    operation.current = 'camera';
    const version = captureVersion.current;
    const capturedAt = Date.now();
    setIsCapturing(true);
    setCaptureMessage('מעבד את הסטיק...');

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        exif: false,
        quality: 1,
        skipProcessing: false,
      });

      if (!photo?.uri || !photo.width || !photo.height) {
        throw new TestStripProcessingError(
          'notDetected',
          'לא הצלחנו לקרוא את התמונה. נסה לצלם שוב.',
        );
      }

      const processed = await processTestStripImage({
        frame: scanFrame,
        height: photo.height,
        uri: photo.uri,
        width: photo.width,
      });

      if (version !== captureVersion.current) return;

      setCaptureMessage('מעולה, אפשר לצלם');
      setImageUri(processed.uri, {
        captureMetadata: { ...timing, source: 'camera', capturedAt },
        originalImageUri: processed.originalUri,
        processingLog: processed.debugLog,
      });
      setCurrentStep('confirm');
      navigation.navigate('ConfirmScan', {
        ...resultParams,
        imageUri: processed.uri,
      });
    } catch (error) {
      if (version !== captureVersion.current) return;
      const fallbackMessage = 'לא הצלחנו לחתוך את הסטיק. ודא שהוא ישר, חד וממלא את המסגרת.';
      const code = error instanceof TestStripProcessingError ? error.code : 'processingFailed';
      const message =
        error instanceof TestStripProcessingError ? error.userMessage : fallbackMessage;

      setScanError({ code, message });
      setCaptureMessage(message);
    } finally {
      captureLock.current = false;
      setIsCapturing(false);
    }
  }

  async function pickGallery() {
    if (captureLock.current) return;
    captureLock.current = true;
    operation.current = 'gallery';
    const version = captureVersion.current;
    setIsCapturing(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ['images'],
        quality: 1,
      });
      if (version !== captureVersion.current || result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      navigation.navigate('CropScanImage', {
        ...resultParams,
        imageUri: asset.uri,
        imageHeight: asset.height,
        imageWidth: asset.width,
      });
    } catch {
      if (version !== captureVersion.current) return;
      setCaptureMessage('לא הצלחנו לפתוח תמונה. נסה שוב או צלם במצלמה.');
    } finally {
      captureLock.current = false;
      setIsCapturing(false);
    }
  }

  if (activeBrandId && scanGateStatus !== 'ready') {
    if (session.error)
      return (
        <View style={styles.permissionScreen}>
          <Text style={styles.permissionText}>{session.error.message}</Text>
          <Pressable onPress={closeScan}>
            <Text style={styles.permissionTitle}>חזרה</Text>
          </Pressable>
        </View>
      );
    return <LoadingGate />;
  }

  if (!permission) {
    return <LoadingGate />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <WaterTexture deep />
        <View style={styles.permissionCard}>
          <View style={styles.permissionIcon}>
            <LineIcon name="camera" color={colors.primary} size={28} />
          </View>
          <Text style={styles.permissionTitle}>צריך הרשאת מצלמה</Text>
          <Text style={styles.permissionText}>
            כדי לצלם רק את סטיק הבדיקה, צריך לאפשר גישה למצלמה.
          </Text>
          <Pressable
            onPress={permission.canAskAgain ? requestPermission : () => Linking.openSettings()}
            style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}
          >
            <Text style={styles.permissionButtonText}>
              {permission.canAskAgain ? 'אישור גישה למצלמה' : 'פתח הגדרות מצלמה'}
            </Text>
          </Pressable>
          <Pressable
            onPress={closeScan}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelButtonText}>חזרה</Text>
          </Pressable>
          <Pressable disabled={isCapturing} onPress={pickGallery} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>בחר תמונה מהגלריה</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const frameColor = isCapturing
    ? colors.success
    : cameraReady
      ? colors.primaryLight
      : colors.white;

  return (
    <View style={styles.screen}>
      {isFocused && foreground ? (
        <CameraView
          ref={cameraRef}
          facing="back"
          mode="picture"
          flash="off"
          enableTorch={false}
          autofocus="off"
          zoom={0}
          onMountError={() => {
            setCameraReady(false);
            setCaptureMessage('המצלמה לא נפתחה. סגור ופתח שוב, או בחר תמונה מהגלריה.');
          }}
          onCameraReady={() => {
            setCameraReady(true);
            setCaptureMessage('מקם את הסטיק בתוך המסגרת ולחץ צילום');
          }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <View pointerEvents="none" style={[styles.mask, { height: scanFrame.y, top: 0 }]} />
      <View
        pointerEvents="none"
        style={[styles.mask, { bottom: 0, top: scanFrame.y + scanFrame.height }]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.mask,
          { height: scanFrame.height, left: 0, top: scanFrame.y, width: scanFrame.x },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.mask,
          {
            height: scanFrame.height,
            right: 0,
            top: scanFrame.y,
            width: Math.max(0, previewWidth - scanFrame.x - scanFrame.width),
          },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.stripFrame,
          {
            borderColor: frameColor,
            height: scanFrame.height,
            left: scanFrame.x,
            top: scanFrame.y,
            width: scanFrame.width,
          },
        ]}
      />

      <View pointerEvents="none" style={[styles.topContent, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.brand}>AquaSense</Text>
        <Text style={styles.title}>צלם רק את הסטיק</Text>
        <Text style={styles.subtitle}>אור אחיד · ללא פלאש · סטיק שלם</Text>
      </View>

      <Pressable
        onPress={closeScan}
        style={({ pressed }) => [
          styles.closeButton,
          { top: insets.top + 14 },
          pressed && styles.pressed,
        ]}
      >
        <LineIcon name="close" color={colors.white} size={24} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="הנחיות הכנה וצילום"
        onPress={() => setPreparationOpen(true)}
        style={[styles.helpButton, { top: insets.top + 14 }]}
      >
        <LineIcon name="help" color={colors.white} size={24} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="שנה כיוון מסגרת הסטיק"
        disabled={isCapturing}
        onPress={() => setHorizontalFrame((value) => !value)}
        style={[styles.orientationButton, { top: insets.top + 108 }]}
      >
        <Text style={styles.prepareText}>
          {horizontalFrame ? 'מסגרת אופקית · שנה' : 'מסגרת אנכית · שנה'}
        </Text>
      </Pressable>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
        <View pointerEvents="none" style={styles.instructionPanel}>
          <Text style={styles.hintText}>
            {remaining > 0
              ? `המתן ${remaining} שניות לפי זמן האריזה`
              : readAt
                ? `עברו ${Math.max(0, Math.floor((now - readAt) / 1000))} שניות מזמן הקריאה — צלם לפי חלון האריזה`
                : 'כל ארבעת הריבועים והידית בתוך המסגרת'}
          </Text>
          <Text style={[styles.statusText, isCapturing && styles.statusReady]}>
            {captureMessage}
          </Text>
        </View>

        {timing.timing === 'unknown' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setPreparationOpen(true)}
            style={styles.prepareButton}
          >
            <Text style={styles.prepareText}>הכנת הסטיק וטיימר קריאה</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            remaining > 0 ? `צילום זמין בעוד ${remaining} שניות` : 'צלם סטיק בדיקה'
          }
          disabled={!cameraReady || isCapturing || !readyForCapture}
          onPress={captureStrip}
          style={({ pressed }) => [
            styles.shutterOuter,
            (!cameraReady || isCapturing || !readyForCapture) && styles.disabled,
            pressed && cameraReady && !isCapturing && styles.pressed,
          ]}
        >
          <View style={styles.shutterInner}>
            {isCapturing ? <ActivityIndicator color={colors.primary} size="small" /> : null}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isCapturing}
          onPress={pickGallery}
          style={styles.galleryAction}
        >
          <Text style={styles.prepareText}>בחר תמונה מהגלריה</Text>
        </Pressable>
      </View>
      <ScanPreparationSheet
        visible={preparationOpen}
        brandId={activeBrandId}
        onClose={() => setPreparationOpen(false)}
        onPrepare={(value) => {
          setTiming(value);
          setNow(Date.now());
          setPreparationOpen(false);
        }}
      />
    </View>
  );
}

function LoadingGate() {
  return (
    <View style={styles.permissionScreen}>
      <WaterTexture deep />
      <View style={styles.permissionCard}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.permissionTitle}>מכינים את הסריקה</Text>
        <Text style={styles.permissionText}>בודקים מנוי ומכסת סריקות כדי לפתוח את הצילום.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  helpButton: { position: 'absolute', right: 16, padding: 10, minHeight: 44, minWidth: 44 },
  orientationButton: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 18,
    minHeight: 44,
    justifyContent: 'center',
  },
  prepareButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: colors.primaryDeep,
  },
  prepareText: {
    color: colors.white,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    ...rtl.textCenter,
  },
  galleryAction: { padding: 12, minHeight: 44 },
  screen: {
    backgroundColor: '#000',
    flex: 1,
  },
  mask: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    position: 'absolute',
  },
  stripFrame: {
    borderRadius: 15,
    borderWidth: 3,
    position: 'absolute',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  topContent: {
    alignItems: 'center',
    left: 22,
    position: 'absolute',
    right: 22,
  },
  brand: {
    color: colors.primaryLight,
    fontFamily: typography.fontFamilyBold,
    fontSize: 26,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  title: {
    color: colors.white,
    fontFamily: typography.fontFamilyBold,
    fontSize: 29,
    fontWeight: '900',
    marginTop: spacing.sm,
    ...rtl.textCenter,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 5,
    ...rtl.textCenter,
  },
  hintText: {
    color: colors.white,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 21,
    ...rtl.textCenter,
  },
  statusText: {
    color: colors.primaryLight,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 7,
    ...rtl.textCenter,
  },
  statusReady: {
    color: colors.success,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    left: 18,
    position: 'absolute',
    width: 44,
  },
  bottomBar: {
    alignItems: 'center',
    bottom: 0,
    gap: 10,
    left: 0,
    paddingHorizontal: 22,
    position: 'absolute',
    right: 0,
  },
  instructionPanel: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(6,15,20,0.78)',
    borderColor: 'rgba(96,221,232,0.34)',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  shutterOuter: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: 'rgba(255,255,255,0.86)',
    borderRadius: 48,
    borderWidth: 4,
    height: 82,
    justifyContent: 'center',
    width: 82,
    ...shadows.button,
  },
  shutterInner: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: '#111',
    borderRadius: 34,
    borderWidth: 2,
    height: 66,
    justifyContent: 'center',
    width: 66,
  },
  permissionScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  permissionCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.xxl,
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 28,
    width: '100%',
    ...shadows.card,
  },
  permissionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  permissionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 21,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  permissionText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 21,
    ...rtl.textCenter,
  },
  permissionButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: radius.round,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
    ...shadows.button,
  },
  permissionButtonText: {
    color: colors.white,
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  cancelButton: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  cancelButtonText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  disabled: {
    opacity: 0.62,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
