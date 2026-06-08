import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, rtl, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function LandingScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <Text style={styles.brandName}>AquaSense</Text>
          <View style={styles.brandDot}><Text style={styles.brandGlyph}>💧</Text></View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroBadge}><Text style={styles.heroBadgeGlyph}>💧</Text></View>
          <Text style={styles.heroTitle}>מים מאוזנים{'\n'}בלי לנחש</Text>
          <Text style={styles.heroSub}>
            סורקים סטיק בדיקה, מקבלים תוצאות מיידיות{'\n'}והנחיות מינון מדויקות לבריכה שלך.
          </Text>
        </View>

        <View style={styles.featureRow}>
          {[
            { v: '3', l: 'סריקות חינם' },
            { v: '✓', l: 'קריאה ברורה' },
            { v: 'א', l: 'עברית מלאה' },
          ].map((f) => (
            <View key={f.l} style={styles.featureCard}>
              <Text style={styles.featureValue}>{f.v}</Text>
              <Text style={styles.featureLabel}>{f.l}</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={() => navigation.navigate('Signup')} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.primaryBtnLabel}>התחילו עכשיו</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Login')} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.secondaryBtnLabel}>כבר יש לי חשבון — התחברות</Text>
        </Pressable>

        <Text style={styles.footer}>תומך ב-AquaChek Pool Test Strips</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40 },
  brandRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10 },
  brandName: { color: colors.primary, fontSize: 18, fontWeight: '900', letterSpacing: 0.5, fontFamily: typography.fontFamily },
  brandDot: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandGlyph: { fontSize: 18 },
  hero: { marginTop: 26, backgroundColor: colors.card, borderRadius: 28, padding: 24, alignItems: 'center', ...shadows.card },
  heroBadge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E0F7FA', alignItems: 'center', justifyContent: 'center' },
  heroBadgeGlyph: { fontSize: 38 },
  heroTitle: { marginTop: 14, fontSize: 28, fontWeight: '900', color: colors.text, ...rtl.textCenter, fontFamily: typography.fontFamily, lineHeight: 36 },
  heroSub: { marginTop: 10, fontSize: 14, fontWeight: '600', color: colors.muted, ...rtl.textCenter, lineHeight: 22, fontFamily: typography.fontFamily },
  featureRow: { marginTop: 16, flexDirection: 'row-reverse', gap: 10 },
  featureCard: { flex: 1, backgroundColor: colors.card, borderRadius: 18, paddingVertical: 14, alignItems: 'center', ...shadows.card },
  featureValue: { fontSize: 22, fontWeight: '900', color: colors.primary, fontFamily: typography.fontFamily },
  featureLabel: { marginTop: 4, fontSize: 11, fontWeight: '800', color: colors.muted, fontFamily: typography.fontFamily },
  primaryBtn: { marginTop: 24, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 18, alignItems: 'center', ...shadows.button },
  primaryBtnLabel: { color: colors.white, fontSize: 17, fontWeight: '900', fontFamily: typography.fontFamily },
  secondaryBtn: { marginTop: 10, paddingVertical: 14, alignItems: 'center' },
  secondaryBtnLabel: { color: colors.primary, fontSize: 14, fontWeight: '900', fontFamily: typography.fontFamily },
  footer: { marginTop: 22, fontSize: 12, fontWeight: '700', color: colors.muted, ...rtl.textCenter, fontFamily: typography.fontFamily },
});
