import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabBar } from '../components/BottomTabBar';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

const MOCK_ITEMS = [
  { date: 'היום', title: 'בדיקה לדוגמה', status: 'מאוזן', value: 'pH 7.3' },
  { date: 'לפני 3 ימים', title: 'בריכה ראשית', status: 'נדרש כלור', value: 'כלור 0.8' },
  { date: 'שבוע שעבר', title: 'בדיקת תחזוקה', status: 'תקין', value: 'אלקליניות 120' },
];

export function HistoryScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.blob} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>מעקב בדיקות</Text>
        <Text style={styles.title}>היסטוריה</Text>
        <Text style={styles.subtitle}>כאן תופיע היסטוריית הסריקות והמדדים של הבריכות שלך.</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>3</Text>
          <Text style={styles.summaryTitle}>בדיקות אחרונות לדוגמה</Text>
          <Text style={styles.summaryText}>בהמשך המסך יחובר לנתוני אמת מ־Supabase ולתוצאות הסריקה.</Text>
        </View>

        <View style={styles.timeline}>
          {MOCK_ITEMS.map((item) => (
            <View key={`${item.date}-${item.title}`} style={styles.itemCard}>
              <View style={styles.dot} />
              <View style={styles.itemCopy}>
                <Text style={styles.itemDate}>{item.date}</Text>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemValue}>{item.value}</Text>
              </View>
              <View style={styles.statusPill}><Text style={styles.statusText}>{item.status}</Text></View>
            </View>
          ))}
        </View>
      </ScrollView>
      <BottomTabBar active="history" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  blob: { position: 'absolute', top: -95, left: -95, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(116,221,237,0.28)' },
  content: { paddingHorizontal: 20, paddingTop: 38, paddingBottom: 150 },
  kicker: { color: colors.primaryDark, fontSize: 12, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  title: { marginTop: 4, color: colors.text, fontSize: 31, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  subtitle: { marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 22, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
  summaryCard: { marginTop: 22, backgroundColor: colors.primary, borderRadius: radius.xxl, padding: spacing.xl, overflow: 'hidden', ...shadows.hero },
  summaryNumber: { color: colors.white, fontSize: 46, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  summaryTitle: { color: colors.white, fontSize: 18, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  summaryText: { marginTop: 6, color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 21, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
  timeline: { marginTop: 18, gap: 12 },
  itemCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, ...shadows.soft },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary },
  itemCopy: { flex: 1 },
  itemDate: { color: colors.muted, fontSize: 11, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  itemTitle: { marginTop: 3, color: colors.text, fontSize: 16, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  itemValue: { marginTop: 2, color: colors.muted, fontSize: 12, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
  statusPill: { backgroundColor: colors.successSoft, borderRadius: radius.round, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { color: colors.success, fontSize: 11, fontWeight: '900', fontFamily: typography.fontFamily },
});