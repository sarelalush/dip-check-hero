import { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, radius } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

export function ScanScreen({ route }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission, requestPermission]);

  if (!permission?.granted) {
    return (
      <View style={styles.permissionPage}>
        <Text style={styles.title}>צריך הרשאת מצלמה</Text>
        <Text style={styles.subtitle}>כדי לסרוק סטיק בדיקה, צריך לאפשר גישה למצלמה.</Text>
        <Pressable onPress={requestPermission} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>אפשר מצלמה</Text>
        </Pressable>
      </View>
    );
  }

  async function capturePlaceholder() {
    setCapturing(true);
    setTimeout(() => {
      setCapturing(false);
      Alert.alert('השלב הבא', `כאן נחבר את מנוע פענוח הצבעים עבור ${route.params.brandId}.`);
    }, 450);
  }

  return (
    <View style={styles.page}>
      <CameraView style={styles.camera} facing="back">
        <View style={styles.overlay}>
          <View style={styles.headerCard}>
            <Text style={styles.kicker}>סריקה</Text>
            <Text style={styles.headerTitle}>מקם את הסטיק בתוך המסגרת</Text>
            <Text style={styles.headerSubtitle}>צלם באור טוב, בלי צל חזק על הפדים.</Text>
          </View>

          <View style={styles.scanFrame}>
            <View style={styles.stripGuide} />
          </View>

          <Pressable onPress={capturePlaceholder} disabled={capturing} style={({ pressed }) => [styles.captureButton, pressed && styles.pressed]}>
            <Text style={styles.captureText}>{capturing ? 'מצלם...' : 'צלם סטיק'}</Text>
          </Pressable>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    padding: 20,
    paddingTop: 58,
    justifyContent: 'space-between',
  },
  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius.xl,
    padding: 18,
  },
  kicker: {
    color: colors.primary,
    textAlign: 'right',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: colors.text,
    textAlign: 'right',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 6,
  },
  headerSubtitle: {
    color: colors.muted,
    textAlign: 'right',
    fontSize: 14,
    marginTop: 5,
  },
  scanFrame: {
    alignSelf: 'center',
    width: '82%',
    height: 360,
    borderWidth: 3,
    borderColor: 'white',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  stripGuide: {
    width: 78,
    height: 300,
    borderWidth: 2,
    borderColor: '#CFFAFE',
    borderStyle: 'dashed',
    borderRadius: 18,
  },
  captureButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  captureText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
  },
  permissionPage: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'right',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'right',
    marginTop: 10,
    marginBottom: 22,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 17,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});
