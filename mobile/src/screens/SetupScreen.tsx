import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function SetupScreen() {
  return (
    <View style={styles.page}>
      <Text style={styles.kicker}>AQUASENSE</Text>
      <Text style={styles.title}>חסר חיבור ל-Supabase</Text>
      <Text style={styles.subtitle}>
        צריך להגדיר ב-Expo את שני המשתנים: EXPO_PUBLIC_SUPABASE_URL ו-EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
      </Text>
      <View style={styles.box}>
        <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_URL</Text>
        <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'right',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 10,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 25,
    textAlign: 'right',
    marginTop: 10,
  },
  box: {
    marginTop: 20,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  code: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'left',
  },
});
