import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { Card } from '../components/Card';
import { ResultCard } from '../components/ResultCard';
import { PrimaryButton } from '../components/PrimaryButton';
import type { DosageRecommendation } from '../domain/dosage';
import { colors, rtl, typography } from '../theme';
import { useAuth } from '../state/AuthContext';

export function DemoResultScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'DemoResult'>) {
  const [needsCare, setNeedsCare] = useState(true);
  const { isAuthenticated } = useAuth();
  const cards: DosageRecommendation[] = [
    {
      paramKey: 'ph',
      labelHe: 'pH',
      measured: needsCare ? 7.9 : 7.4,
      target: 7.4,
      unit: '',
      status: needsCare ? 'high' : 'ok',
      active: false,
      exactAmountAvailable: false,
      actionHe: needsCare
        ? 'יש לאמת מדידה לפני טיפול. הגרסה הנוכחית אינה מחשבת מינון חומרים.'
        : 'הערך בטווח.',
    },
    {
      paramKey: 'freeChlorine',
      labelHe: 'כלור חופשי',
      measured: 2,
      target: 2,
      unit: 'ppm',
      status: 'ok',
      exactAmountAvailable: false,
      actionHe: 'הערך בטווח.',
    },
    {
      paramKey: 'alkalinity',
      labelHe: 'אלקליניות',
      measured: 100,
      target: 100,
      unit: 'ppm',
      status: 'ok',
      exactAmountAvailable: false,
      actionHe: 'הערך בטווח.',
    },
  ];
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
            { value: true, label: 'נדרש אימות' },
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
          <Text style={styles.actionTitle}>מה עושים עכשיו</Text>
          <Text style={styles.body}>
            {needsCare
              ? 'ה־pH מעל טווח ההשוואה בדוגמה. יש לאמת מדידה לפני טיפול ולקבל הוראות לפי המוצר והמצב בפועל.'
              : 'המדדים בדוגמה בטווח ההשוואה. זו אינה הוכחה שהמים בטוחים לרחצה.'}
          </Text>
        </Card>
        {cards.map((rec) => (
          <ResultCard key={rec.paramKey} rec={rec} />
        ))}
        <Text style={styles.body}>
          אפשר לראות היסטוריית מדדים ולהגדיר תזכורות בדיקה. תזכורת אינה אישור לטיפול או לרחצה.
        </Text>
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
