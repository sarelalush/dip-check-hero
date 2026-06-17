import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { getStripAnalysisConfig } from '../services/stripAnalysisService';
import { isSupabaseConfigured } from '../integrations/supabase/client';
import { colors, rtl, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ReleaseChecklist'>;
type ChecklistTone = 'done' | 'partial' | 'missing';
const RELEASE_POOL_IMAGE = require('../../assets/images/home-pool.png');

const analysisConfig = getStripAnalysisConfig();

const checklistItems: Array<{ label: string; note: string; tone: ChecklistTone }> = [
  {
    label: 'Supabase מחובר',
    note: isSupabaseConfigured ? 'קיימת תצורת Supabase באפליקציה.' : 'חסרים משתני סביבה ל-Supabase.',
    tone: isSupabaseConfigured ? 'done' : 'missing',
  },
  {
    label: 'Gemini מוגדר בצד השרת',
    note: analysisConfig.mode === 'remote' || analysisConfig.mode === 'auto' ? 'הלקוח מוכן לקרוא ל-Edge Function.' : 'מצב הניתוח מוגדר למוק/נייטיב.',
    tone: analysisConfig.mode === 'remote' || analysisConfig.mode === 'auto' ? 'partial' : 'missing',
  },
  { label: 'סריקה עובדת', note: 'זרימת Scan → Confirm → Results קיימת.', tone: 'done' },
  { label: 'היסטוריה עובדת', note: 'בדיקות נשמרות ונפתחות לפי testId.', tone: 'done' },
  { label: 'תמונות בריכה עובדות', note: 'יש תמונת כיסוי מקומית וסנכרון Storage כשמחוברים.', tone: 'done' },
  { label: 'Privacy / Terms קיימים', note: 'נוספו מסכי מדיניות פרטיות ותנאי שימוש.', tone: 'done' },
  { label: 'מחיקת חשבון', note: 'יש מסך בקשה/אישור. מחיקה מלאה עדיין דורשת backend מאובטח.', tone: 'partial' },
  { label: 'התראות', note: 'העדפות תזכורת קיימות מקומית. Push/Local notifications עדיין לא סופי.', tone: 'partial' },
  { label: 'תשלומים', note: 'מסך תוכנית ושימוש קיים. רכישה בפועל עדיין לא מחוברת.', tone: 'partial' },
];

export function ReleaseChecklistScreen({ navigation }: Props) {
  return (
    <ImageBackground source={RELEASE_POOL_IMAGE} resizeMode="cover" style={styles.root}>
      <View style={styles.waterWash} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.navigate('Settings')} style={styles.iconButton}>
            <LineIcon name="chevronLeft" color={colors.primaryDark} size={18} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>פנימי</Text>
            <Text style={styles.title}>בדיקות לפני פרסום</Text>
            <Text style={styles.subtitle}>רשימת מצב בסיסית לפני יציאה לחנות. המסך לא מחליף QA מלא.</Text>
          </View>
        </View>

        <Card style={styles.card}>
          {checklistItems.map((item) => (
            <View key={item.label} style={styles.item}>
              <View style={[styles.statusDot, getToneStyle(item.tone)]}>
                <LineIcon name={item.tone === 'missing' ? 'close' : 'check'} color={item.tone === 'missing' ? colors.danger : colors.white} size={13} />
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>{item.label}</Text>
                <Text style={styles.itemNote}>{item.note}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </ImageBackground>
  );
}

function getToneStyle(tone: ChecklistTone) {
  if (tone === 'done') return styles.doneDot;
  if (tone === 'partial') return styles.partialDot;
  return styles.missingDot;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  waterWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(245,253,255,0.72)' },
  content: { paddingHorizontal: 20, paddingTop: 44, paddingBottom: 36 },
  topBar: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  kicker: { color: colors.primaryDark, fontFamily: typography.fontFamilyBold, fontSize: 11, fontWeight: '900', ...rtl.text },
  title: { marginTop: 4, color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 23, fontWeight: '900', ...rtl.text },
  subtitle: { marginTop: 6, color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, fontWeight: '800', lineHeight: 19, ...rtl.text },
  card: { marginTop: 20, gap: 12 },
  item: { flexDirection: 'row-reverse', alignItems: 'center', gap: 11, borderRadius: 16, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.borderSoft, padding: 12 },
  statusDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  doneDot: { backgroundColor: colors.success },
  partialDot: { backgroundColor: colors.warning },
  missingDot: { backgroundColor: colors.dangerSoft },
  itemCopy: { flex: 1 },
  itemTitle: { color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 13, fontWeight: '900', ...rtl.text },
  itemNote: { marginTop: 4, color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 11, fontWeight: '800', lineHeight: 17, ...rtl.text },
});
