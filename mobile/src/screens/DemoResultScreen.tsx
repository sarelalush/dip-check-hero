import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { Card } from '../components/Card';
import { ResultCard } from '../components/ResultCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { calculateDosage, type DosageRecommendation } from '../domain/dosage';
import { colors, rtl, typography } from '../theme';
import { useAuth } from '../state/AuthContext';
import { GuidanceSources } from '../components/GuidanceSources';
import { TreatmentSteps } from '../components/TreatmentSteps';
import { DisclosureSection } from '../components/DisclosureSection';

export function DemoResultScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'DemoResult'>) {
  const [needsCare, setNeedsCare] = useState(true);
  const { isAuthenticated } = useAuth();
  const cards: DosageRecommendation[] = [
    {
      paramKey: 'ph',
      labelHe: 'pH',
      measured: needsCare ? 7.8 : 7.2,
      target: 7.4,
      unit: '',
      status: needsCare ? 'high' : 'ok',
      active: false,
      exactAmountAvailable: false,
      actionHe: needsCare
        ? 'אם החריגה אומתה, הורד pH עם חומר ייעודי לפי מינון התווית.'
        : 'הערך בטווח.',
    },
    {
      paramKey: 'freeChlorine',
      labelHe: 'כלור חופשי',
      measured: needsCare ? 0.5 : 3,
      target: 2,
      unit: 'ppm',
      status: needsCare ? 'low' : 'ok',
      exactAmountAvailable: false,
      actionHe: 'הערך בטווח.',
    },
    {
      paramKey: 'alkalinity',
      labelHe: 'אלקליניות',
      measured: needsCare ? 40 : 80,
      target: 100,
      unit: 'ppm',
      status: needsCare ? 'low' : 'ok',
      exactAmountAvailable: false,
      actionHe: 'הערך בטווח.',
    },
  ];
  // Product demo only: shared presentation policy, no scan or provider request.
  const demoDosage = calculateDosage({
    id: 'demo', analyzedAt: Date.now(), accepted: true, isValidStrip: true,
    overallStatus: { label: 'דוגמה', tone: 'neutral' }, recommendation: '',
    parameters: cards.map(rec => ({
      key: rec.paramKey, name: rec.labelHe, value: rec.measured, unit: rec.unit,
      idealRange: rec.paramKey === 'ph' ? { min: 7.2, max: 7.6, label: 'טווח ההשוואה בדוגמה' }
        : rec.paramKey === 'freeChlorine' ? { min: 1, max: 3, label: 'טווח ההשוואה בדוגמה' }
          : { min: 80, max: 120, label: 'טווח ההשוואה בדוגמה' },
      status: { kind: rec.status, label: '', tone: 'neutral' }, recommendation: '', progress: 0,
    })),
  });
  const demoPrimary = demoDosage.primaryRecommendation;
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Text style={styles.link}>חזרה</Text>
        </Pressable>
        <Text style={styles.title}>כך נראית בדיקה ב־AquaSense</Text>
        <Text style={styles.note}>
          המחשה בלבד: אלה נתונים לדוגמה, לא מדידה של הבריכה שלך או הוראות לטיפול בה.
        </Text>
        <View style={styles.tabs}>
          {[
            { value: true, label: 'דרוש טיפול' },
            { value: false, label: 'בטווח ההשוואה' },
          ].map((option) => (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              accessibilityState={{ selected: needsCare === option.value }}
              onPress={() => setNeedsCare(option.value)}
              style={[styles.tab, needsCare === option.value && styles.selected]}
            >
              <Text style={[styles.tabText, needsCare === option.value && styles.selectedText]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Card style={styles.action}>
          <Text style={styles.actionTitle}>{demoPrimary ? `מתחילים ב${demoPrimary.labelHe}` : 'המדדים בטווח'}</Text>
          {demoPrimary ? <TreatmentSteps steps={demoPrimary.actionHe.split('\n')} />
            : <Text style={styles.body}>המשך מעקב רגיל.</Text>}
          {demoPrimary ? <Text style={styles.note}>מטפלים עכשיו במדד אחד. בבדיקה הבאה נבחר מחדש את הטיפול לפי כל הערכים, גם אם השתנו.</Text> : null}
          <Text style={styles.note}>אמת חריגה לפני הוספת חומר. פעל לפי התווית ואל תערבב חומרים.</Text>
        </Card>
        {demoDosage.recommendations.map((rec) => (
          <ResultCard key={rec.paramKey} rec={rec} compact />
        ))}
        <DisclosureSection title="מידע נוסף">
          <Text style={styles.note}>{demoDosage.safetyNote}</Text>
          <GuidanceSources />
        </DisclosureSection>
        <PrimaryButton
          label={isAuthenticated ? 'חזרה' : 'המשך להרשמה'}
          icon="user"
          onPress={() => (isAuthenticated ? navigation.goBack() : navigation.navigate('Signup'))}
        />
        <Text style={styles.note}>
          השימוש בסריקות אמיתיות דורש מנוי. הדוגמה זמינה ללא צילום וללא חיוב.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14, alignSelf: 'center', width: '100%', maxWidth: 460 },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 26,
    lineHeight: 36,
    ...rtl.text,
  },
  body: {
    color: colors.text,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    lineHeight: 23,
    ...rtl.text,
  },
  note: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 20,
    ...rtl.text,
  },
  back: { paddingVertical: 10, minHeight: 44 },
  link: { color: colors.primaryDeep, fontFamily: typography.fontFamilySemiBold, ...rtl.text },
  tabs: { flexDirection: 'row-reverse', gap: 10 },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.primaryDeep },
  tabText: { color: colors.text, fontFamily: typography.fontFamilySemiBold, ...rtl.textCenter },
  selectedText: { color: colors.white },
  action: { gap: 8, backgroundColor: colors.primarySoft },
  actionTitle: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    ...rtl.text,
  },
});
