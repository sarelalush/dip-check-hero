import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'> & {
  user: User;
};

export function HomeScreen({ navigation, user }: Props) {
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('שגיאה', error.message);
  }

  const name = user.user_metadata?.display_name || user.email || 'משתמש';

  return (
    <View style={styles.page}>
      <View style={styles.topBar}>
        <Pressable onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutText}>יציאה</Text>
        </Pressable>
        <View>
          <Text style={styles.hello}>שלום</Text>
          <Text style={styles.name}>{name}</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.kicker}>AQUASENSE</Text>
        <Text style={styles.heroTitle}>בדיקת מים{`\n`}לבריכה שלך</Text>
        <Text style={styles.heroSubtitle}>צלם את סטיק הבדיקה וקבל המלצה כמה חומר להוסיף.</Text>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={() => navigation.navigate('SelectStrip')} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
          <Text style={styles.primaryActionText}>סרוק סטיק עכשיו</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Pools')} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
          <Text style={styles.secondaryActionText}>הבריכות שלי</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('History')} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
          <Text style={styles.secondaryActionText}>ההיסטוריה שלי</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>תומך ב-AquaChek Pool Test Strips</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    paddingTop: 58,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  logoutText: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  hello: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
    maxWidth: 230,
  },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 30,
    padding: 26,
    minHeight: 230,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  kicker: {
    color: '#CFFAFE',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '900',
    textAlign: 'right',
  },
  heroTitle: {
    color: 'white',
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 10,
  },
  heroSubtitle: {
    color: '#E0F7FE',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'right',
    marginTop: 12,
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  primaryAction: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: 20,
    alignItems: 'center',
  },
  primaryActionText: {
    color: 'white',
    fontSize: 19,
    fontWeight: '900',
  },
  secondaryAction: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingVertical: 17,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  footer: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: 'auto',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});
