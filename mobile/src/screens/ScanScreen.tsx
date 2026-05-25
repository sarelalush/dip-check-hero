import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

export function ScanScreen({ route }: Props) {
  function showNextStep() {
    Alert.alert('סריקה', `המצלמה תחזור בגרסת EAS/Apple Developer. כרגע Expo Go מריץ תצוגת בדיקה עבור ${route.params.brandId}.`);
  }

  return (
    <View style={styles.page}>
      <Text style={styles.kicker}>AQUASENSE</Text>
      <Text style={styles.title}>סריקת סטיק</Text>
      <Text style={styles.subtitle}>
        כרגע אנחנו ב-Expo Go. כדי שהאפליקציה תיפתח בלי קריסה, המצלמה כבויה זמנית. בשלב הבא נחבר צילום אמיתי דרך EAS Build.
      </Text>

      <View style={styles.frame}>
        <View style={styles.stripGuide}>
          <View style={[styles.pad, { backgroundColor: '#FFE066' }]} />
          <View style={[styles.pad, { backgroundColor: '#FF8C42' }]} />
          <View style={[styles.pad, { backgroundColor: '#E63946' }]} />
          <View style={[styles.pad, { backgroundColor: '#A8DADC' }]} />
          <View style={[styles.pad, { backgroundColor: '#457B9D' }]} />
        </View>
      </View>

      <Pressable onPress={showNextStep} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>המשך בדיקה</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 58 },
  kicker: { color: colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 2, textAlign: 'right' },
  title: { color: colors.text, fontSize: 32, fontWeight: '900', textAlign: 'right', marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'right', marginTop: 10 },
  frame: { marginTop: 30, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 28, padding: 28, alignItems: 'center' },
  stripGuide: { width: 92, height: 330, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: colors.primarySoft },
  pad: { flex: 1 },
  button: { backgroundColor: colors.primary, borderRadius: radius.xl, paddingVertical: 18, alignItems: 'center', marginTop: 24 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: '900' },
  pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
});
