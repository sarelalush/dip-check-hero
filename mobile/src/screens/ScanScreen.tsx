import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LineIcon } from '../components/LineIcon';
import { WaterTexture } from '../components/WaterVisuals';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import { useAuth } from '../state/AuthContext';
import { useScanSession } from '../state/ScanSessionContext';
import { processTestStripImage, TestStripProcessingError, type TestStripFrame } from '../services/testStripImageProcessing';
import { canCreateScan, hasActiveSubscription } from '../services/usageService';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;
type ScanGateStatus = 'checking' | 'ready';

export function ScanScreen({ navigation, route }: Props) {
  const { accountId } = useAuth();
  const { resetScanSession, session, setCurrentStep, setImageUri, setScanError, startScanSession } = useScanSession();
  const didInitializeSession = useRef(false);
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMessage, setCaptureMessage] = useState('מקם את הסטיק בתוך המסגרת ולחץ צילום');
  const [scanGateStatus, setScanGateStatus] = useState<ScanGateStatus>('checking');
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
    const frameHeight = Math.min(previewHeight * 0.56, 540);
    const frameWidth = Math.max(58, Math.min(92, frameHeight * 0.17));
    const preferredTop = previewHeight * 0.24;
    const minTop = insets.top + 132;
    const maxTop = previewHeight - frameHeight - insets.bottom - 168;
    const y = Math.max(minTop, Math.min(preferredTop, maxTop));
    const x = (previewWidth - frameWidth) / 2;

    return {
      height: frameHeight,
      previewHeight,
      previewWidth,
      width: frameWidth,
      x,
      y,
    };
  }, [insets.bottom, insets.top, previewHeight, previewWidth]);

  useEffect(() => {
    if (didInitializeSession.current) return;
    didInitializeSession.current = true;

    if (route.params?.brandId || route.params?.poolId) {
      startScanSession({
        brandId: route.params?.brandId ?? session.selectedBrandId,
        poolId: route.params?.poolId ?? session.selectedPoolId,
      });
    }
  }, [
    route.params?.brandId,
    route.params?.poolId,
    session.selectedBrandId,
    session.selectedPoolId,
    startScanSession,
  ]);

  useEffect(() => {
    if (activeBrandId) return;

    setScanError({
      code: 'missingBrand',
      message: 'בחר מותג סטיק לפני שמתחילים סריקה.',
    });
    navigation.replace('SelectStrip', route.params?.poolId ? { poolId: route.params.poolId } : undefined);
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

    void verifyScanAccess();

    return () => {
      cancelled = true;
    };
  }, [accountId, activeBrandId, navigation]);

  function closeScan() {
    resetScanSession();
    navigation.navigate('Home');
  }

  async function captureStrip() {
    if (!cameraRef.current || !cameraReady || isCapturing || scanGateStatus !== 'ready') {
      return;
    }

    setIsCapturing(true);
    setCaptureMessage('מעבד את הסטיק...');

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        exif: true,
        quality: 1,
        skipProcessing: false,
      });

      if (!photo?.uri || !photo.width || !photo.height) {
        throw new TestStripProcessingError('notDetected', 'לא הצלחנו לקרוא את התמונה. נסה לצלם שוב.');
      }

      const processed = await processTestStripImage({
        frame: scanFrame,
        height: photo.height,
        uri: photo.uri,
        width: photo.width,
      });

      setCaptureMessage('מעולה, אפשר לצלם');
      setImageUri(processed.uri, {
        originalImageUri: processed.originalUri,
        processingLog: processed.debugLog,
      });
      setCurrentStep('confirm');
      navigation.navigate('ConfirmScan', {
        ...resultParams,
        imageUri: processed.uri,
      });
    } catch (error) {
      const fallbackMessage = 'לא הצלחנו לחתוך את הסטיק. ודא שהוא ישר, חד וממלא את המסגרת.';
      const code = error instanceof TestStripProcessingError ? error.code : 'processingFailed';
      const message = error instanceof TestStripProcessingError ? error.userMessage : fallbackMessage;

      setScanError({ code, message });
      setCaptureMessage(message);
    } finally {
      setIsCapturing(false);
    }
  }

  if (activeBrandId && scanGateStatus !== 'ready') {
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
          <Text style={styles.permissionText}>כדי לצלם רק את סטיק הבדיקה, צריך לאפשר גישה למצלמה.</Text>
          <Pressable onPress={requestPermission} style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}>
            <Text style={styles.permissionButtonText}>אישור גישה למצלמה</Text>
          </Pressable>
          <Pressable onPress={closeScan} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
            <Text style={styles.cancelButtonText}>חזרה</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const frameColor = isCapturing ? colors.success : cameraReady ? colors.primaryLight : colors.white;

  return (
    <View style={styles.screen}>
      <CameraView
        ref={cameraRef}
        facing="back"
        mode="picture"
        onCameraReady={() => {
          setCameraReady(true);
          setCaptureMessage('מקם את הסטיק בתוך המסגרת ולחץ צילום');
        }}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="none" style={[styles.mask, { height: scanFrame.y, top: 0 }]} />
      <View
        pointerEvents="none"
        style={[styles.mask, { bottom: 0, top: scanFrame.y + scanFrame.height }]}
      />
      <View
        pointerEvents="none"
        style={[styles.mask, { height: scanFrame.height, left: 0, top: scanFrame.y, width: scanFrame.x }]}
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
        <Text style={styles.subtitle}>מקם את הסטיק בדיוק בתוך המסגרת</Text>
      </View>

      <View pointerEvents="none" style={[styles.lowerHint, { top: scanFrame.y + scanFrame.height + 12 }]}>
        <Text style={styles.hintText}>ודא שכל הסטיק וריבועי הצבע נמצאים בתוך הקווים</Text>
        <Text style={[styles.statusText, isCapturing && styles.statusReady]}>{captureMessage}</Text>
      </View>

      <Pressable onPress={closeScan} style={({ pressed }) => [styles.closeButton, { top: insets.top + 14 }, pressed && styles.pressed]}>
        <LineIcon name="close" color={colors.white} size={24} />
      </Pressable>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
        <View style={styles.examplesPanel}>
          <View style={styles.exampleBad}>
            <View style={styles.badImageBackground}>
              <MockMiniStrip />
            </View>
            <View style={styles.badBadge}>
              <LineIcon name="close" color={colors.white} size={15} />
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.exampleGood}>
            <MockMiniStrip />
            <View style={styles.goodBadge}>
              <LineIcon name="check" color={colors.white} size={15} />
            </View>
          </View>
        </View>

        <Pressable
          disabled={!cameraReady || isCapturing}
          onPress={captureStrip}
          style={({ pressed }) => [
            styles.shutterOuter,
            (!cameraReady || isCapturing) && styles.disabled,
            pressed && cameraReady && !isCapturing && styles.pressed,
          ]}
        >
          <View style={styles.shutterInner}>
            {isCapturing ? <ActivityIndicator color={colors.primary} size="small" /> : null}
          </View>
        </Pressable>
      </View>
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

function MockMiniStrip() {
  const pads = ['#F2F4EF', '#7ECFD0', '#A4CFA2', '#F2C64B', '#F39C38', '#E7767D', '#A56BC0'];

  return (
    <View style={styles.miniStrip}>
      {pads.map((pad) => (
        <View key={pad} style={[styles.miniPad, { backgroundColor: pad }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
  lowerHint: {
    alignItems: 'center',
    left: 24,
    position: 'absolute',
    right: 24,
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
    gap: 16,
    left: 0,
    paddingHorizontal: 22,
    position: 'absolute',
    right: 0,
  },
  examplesPanel: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(10,18,24,0.78)',
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 112,
    paddingHorizontal: 18,
    ...shadows.card,
  },
  exampleBad: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  exampleGood: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  badImageBackground: {
    alignItems: 'center',
    backgroundColor: colors.water,
    borderRadius: 12,
    height: 86,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 86,
  },
  badBadge: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    top: 6,
    width: 32,
  },
  goodBadge: {
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 34,
    top: 5,
    width: 32,
  },
  divider: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginHorizontal: 12,
    width: 1,
  },
  miniStrip: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 4,
    height: 88,
    justifyContent: 'space-evenly',
    paddingVertical: 3,
    width: 15,
  },
  miniPad: {
    borderRadius: 2,
    height: 10,
    width: 10,
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
