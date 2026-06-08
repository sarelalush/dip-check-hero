import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabBar } from '../components/BottomTabBar';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const SETTINGS = [
  { title: 'פרטי חשבון', subtitle: 'שם, אימייל והעדפות משתמש', icon: '👤' },
  { title: 'תזכורות בדיקה', subtitle: 'קבלת התראה לבדיקת מים', icon: '🔔' },
  { title: 'העדפות אפליקציה', subtitle: 'שפה, יחידות ומראה', icon: '⚙️' },
  { title: 'עזרה ותמיכה', subtitle: 'שאלות נפוצות ויצירת קשר', icon: '💬' },
];

export function SettingsScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.blob} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>התאמה אישית</Text>
        <Text style={styles.title}>הגדרות</Text>
        <Text style={styles.subtitle}>בקרוב תוכל לנהל חשבון, תזכורות והעדפות בדיקה.</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>ד</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>משתמש Dip Check</Text>
            <Text style={styles.profileMeta}>מצב פיתוח · חשבון לדוגמה</Text>
          </View>
        </View>

        <View style={styles.list}>
          {SETTINGS.map((item) => (
            <Pressable key={item.title} style={({ pressed }) => [styles.settingCard, pressed && styles.pressed]}>
              <View style={styles.settingIcon}><Text style={styles.settingIconText}>{item.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>{item.title}</Text>
                <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.chevron}>‹</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <BottomTabBar active="settings" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  blob: { position: 'absolute', top: -115, right: -95, width: 265, height: 265, borderRadius: 133, backgroundColor: 'rgba(6,168,199,0.16)' },
  content: { paddingHorizontal: 20, paddingTop: 38, paddingBottom: 150 },
  kicker: { color: colors.primaryDark, fontSize: 12, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  title: { marginTop: 4, color: colors.text, fontSize: 31, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  subtitle: { marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 22, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
  profileCard: { marginTop: 22, backgroundColor: colors.card, borderRadius: radius.xxl, padding: spacing.lg, flexDirection: 'row-reverse', alignItems: 'center', gap: 14, ...shadows.card },
  avatar: { width: 58, height: 58, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.button },
  avatarText: { color: colors.white, fontSize: 24, fontWeight: '900', fontFamily: typography.fontFamily },
  profileName: { color: colors.text, fontSize: 17, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  profileMeta: { marginTop: 4, color: colors.muted, fontSize: 12, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
  list: { marginTop: 18, gap: 12 },
  settingCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, ...shadows.soft },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  settingIcon: { width: 46, height: 46, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  settingIconText: { fontSize: 20 },
  settingTitle: { color: colors.text, fontSize: 16, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  settingSubtitle: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
  chevron: { color: colors.primaryDark, fontSize: 24, fontWeight: '900' },
});