import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { colors, radius, rtl, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Support'>;

const SUPPORT_EMAIL = 'support@dipcheck.app';
const FAQ_ITEMS = [
  {
    title: 'איך לצלם סטיק נכון',
    text: 'צלמו באור יום טבעי, על רקע לבן, כשהסטיק חד וכל ריבועי הצבע נראים.',
  },
  {
    title: 'למה חשוב להזין נפח בריכה',
    text: 'נפח הבריכה משפיע על חישובי טיפול ומינון. בלי נפח מדויק האפליקציה תציג הנחיה כללית יותר.',
  },
  {
    title: 'מה זה ביטחון נמוך',
    text: 'זה סימן שאיכות הצילום, התאורה או המסגור פחות אידאליים. כדאי לצלם מחדש אם התוצאה לא נראית הגיונית.',
  },
  {
    title: 'למה התוצאה יכולה להשתנות בין צילומים',
    text: 'תאורה, זווית צילום, זמן המתנה אחרי טבילה ומיקום הסטיק בתמונה יכולים להשפיע על קריאת הצבעים.',
  },
  {
    title: 'מה לעשות אם הסריקה נכשלה',
    text: 'נסו לבחור תמונה ברורה יותר או לצלם מחדש. אם אין חיבור אינטרנט, הבדיקה יכולה להמשיך בנתוני fallback מקומיים.',
  },
];

export function SupportScreen({ navigation }: Props) {
  const [message, setMessage] = useState('');

  async function contactSupport() {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('תמיכה באפליקציית AquaSense')}`;
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
      return;
    }

    setMessage(`אפשר לפנות לתמיכה בכתובת ${SUPPORT_EMAIL}`);
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.navigate('Settings')} style={styles.iconButton}>
            <LineIcon name="chevronLeft" color={colors.primaryDark} size={18} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>עזרה ותמיכה</Text>
            <Text style={styles.subtitle}>תשובות מהירות ויצירת קשר</Text>
          </View>
        </View>

        <View style={styles.list}>
          {FAQ_ITEMS.map((item) => (
            <Card compact key={item.title} style={styles.faqCard}>
              <Text style={styles.faqTitle}>{item.title}</Text>
              <Text style={styles.faqText}>{item.text}</Text>
            </Card>
          ))}

          <Card style={styles.contactCard}>
            <View style={styles.contactIcon}>
              <LineIcon name="help" color={colors.primaryDark} size={22} />
            </View>
            <Text style={styles.contactTitle}>צריכים עזרה נוספת?</Text>
            <Text style={styles.contactText}>כתבו לנו ונחזור אליכם בהקדם.</Text>
            <Text style={styles.email}>{SUPPORT_EMAIL}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <Pressable onPress={contactSupport} style={({ pressed }) => [styles.contactButton, pressed && styles.pressed]}>
              <Text style={styles.contactButtonText}>שלח הודעה לתמיכה</Text>
            </Pressable>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 44, paddingBottom: 42 },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 22, fontWeight: '900', ...rtl.text },
  subtitle: { marginTop: 4, color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, fontWeight: '800', ...rtl.text },
  list: { marginTop: 18, gap: 12 },
  faqCard: { gap: 6 },
  faqTitle: { color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 14, fontWeight: '900', ...rtl.text },
  faqText: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, fontWeight: '800', lineHeight: 19, ...rtl.text },
  contactCard: { alignItems: 'center', gap: 8 },
  contactIcon: { width: 54, height: 54, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  contactTitle: { color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 16, fontWeight: '900', ...rtl.textCenter },
  contactText: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, fontWeight: '800', ...rtl.textCenter },
  email: { color: colors.primaryDark, fontFamily: typography.fontFamilySemiBold, fontSize: 13, fontWeight: '900' },
  message: { color: colors.warning, fontFamily: typography.fontFamilyRegular, fontSize: 11, fontWeight: '800', ...rtl.textCenter },
  contactButton: { marginTop: 6, width: '100%', borderRadius: radius.round, backgroundColor: colors.primary, paddingVertical: 13, alignItems: 'center', ...shadows.button },
  contactButtonText: { color: colors.white, fontFamily: typography.fontFamilyBold, fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
