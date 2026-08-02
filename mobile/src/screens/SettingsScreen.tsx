import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabBar } from '../components/BottomTabBar';
import { LineIcon, type LineIconName } from '../components/LineIcon';
import { WebPhoneFrame } from '../components/WebPhoneFrame';
import { useAuth } from '../state/AuthContext';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const SETTINGS_POOL_IMAGE = require('../../assets/images/home-pool.png');

export function SettingsScreen({ navigation }: Props) {
  const { isGuest, user, signOut, updateDisplayName } = useAuth();
  const [busy, setBusy] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [message, setMessage] = useState('');

  const displayName = useMemo(() => {
    return (
      (user?.user_metadata?.display_name as string | undefined) ||
      (user?.user_metadata?.full_name as string | undefined) ||
      user?.email ||
      'משתמש AquaSense'
    );
  }, [user]);

  const [nameInput, setNameInput] = useState(displayName);
  const email = user?.email ?? 'לא מחובר';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'ד';

  useEffect(() => {
    setNameInput(displayName);
  }, [displayName]);

  async function handleSaveName() {
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setMessage('יש להזין שם תצוגה.');
      return;
    }

    setSavingName(true);
    setMessage('');
    const result = await updateDisplayName(trimmedName);
    setSavingName(false);
    setMessage(result.error ?? 'שם התצוגה נשמר.');
  }

  async function handleSignOut() {
    setBusy(true);
    await signOut();
    setBusy(false);
  }

  return (
    <WebPhoneFrame>
    <ImageBackground source={SETTINGS_POOL_IMAGE} resizeMode="cover" style={styles.root}>
      <View style={styles.waterWash} />
      <View style={styles.blob} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>התאמה אישית</Text>
        <Text style={styles.title}>הגדרות</Text>
        <Text style={styles.subtitle}>ניהול חשבון, מנוי, בריכות, תזכורות ותמיכה.</Text>

        <Section title="פרטי חשבון">
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileMeta}>{email}</Text>
            </View>
          </View>
          <TextInput
            style={styles.input}
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="שם תצוגה"
            placeholderTextColor={colors.muted}
          />
          {message ? <Text style={[styles.message, message.includes('נשמר') ? styles.successMessage : styles.errorMessage]}>{message}</Text> : null}
          <View style={styles.rowButtons}>
            <Pressable disabled={savingName} onPress={handleSaveName} style={({ pressed }) => [styles.smallPrimaryButton, pressed && styles.pressed, savingName && styles.disabled]}>
              <Text style={styles.smallPrimaryText}>{savingName ? 'שומר...' : 'שמירת שם'}</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={handleSignOut} style={({ pressed }) => [styles.smallDangerButton, pressed && styles.pressed, busy && styles.disabled]}>
              <Text style={styles.smallDangerText}>
                {busy ? 'יוצא...' : isGuest ? 'חזרה למסך הכניסה' : 'יציאה מהחשבון'}
              </Text>
            </Pressable>
          </View>
          <SettingsRow
            danger
            icon="help"
            label="מחיקת חשבון"
            value="בקשת מחיקה מאובטחת דרך תמיכה"
            onPress={() => navigation.navigate('DeleteAccount')}
          />
        </Section>

        <Section title="מנוי ושימוש">
          <SettingsRow
            icon="results"
            label="מנוי ושימוש"
            value="תוכנית, מכסות חודשיות ותוספות"
            onPress={() => navigation.navigate('PlanUsage')}
          />
        </Section>

        <Section title="בריכות ותזכורות">
          <SettingsRow
            icon="bell"
            label="תזכורות בדיקה"
            value="ניהול תזכורות לכל בריכה"
            onPress={() => navigation.navigate('Reminders')}
          />
          <SettingsRow
            icon="scan"
            label="ניהול בריכות"
            value="עריכת פרטי בריכה, נפח וסוג סטיק"
            onPress={() => navigation.navigate('Pools')}
          />
        </Section>

        <Section title="עזרה ומשפטי">
          <SettingsRow icon="help" label="עזרה ותמיכה" value="שאלות נפוצות ויצירת קשר" onPress={() => navigation.navigate('Support')} />
          <SettingsRow icon="results" label="מדיניות פרטיות" value="איזה מידע נשמר ואיך משתמשים בו" onPress={() => navigation.navigate('PrivacyPolicy')} />
          <SettingsRow icon="history" label="תנאי שימוש" value="המלצות, אחריות ושימוש בטוח" onPress={() => navigation.navigate('Terms')} />
        </Section>
      </ScrollView>
      <BottomTabBar active="settings" navigation={navigation} />
    </ImageBackground>
    </WebPhoneFrame>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingsRow({ danger, icon, label, onPress, value }: { danger?: boolean; icon: LineIconName; label: string; onPress: () => void; value: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}>
      <View style={[styles.infoIcon, danger && styles.dangerIcon]}>
        <LineIcon name={icon} color={danger ? colors.danger : colors.primaryDark} size={18} />
      </View>
      <View style={styles.preferenceCopy}>
        <Text style={[styles.preferenceLabel, danger && styles.dangerText]}>{label}</Text>
        <Text style={styles.preferenceValue} numberOfLines={2}>{value}</Text>
      </View>
      <LineIcon name="chevronLeft" color={colors.muted} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  waterWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(245,253,255,0.72)' },
  blob: { position: 'absolute', top: -115, right: -95, width: 265, height: 265, borderRadius: 133, backgroundColor: 'rgba(6,168,199,0.16)' },
  content: { paddingHorizontal: 20, paddingTop: 38, paddingBottom: 150 },
  kicker: { color: colors.primaryDark, fontSize: 12, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  title: { marginTop: 4, color: colors.text, fontSize: 31, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  subtitle: { marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 22, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
  section: { marginTop: 20, gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamilyBold },
  sectionCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, gap: 12, ...shadows.card },
  profileCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.button },
  avatarText: { color: colors.white, fontSize: 24, fontWeight: '900', fontFamily: typography.fontFamily },
  profileCopy: { flex: 1 },
  profileName: { color: colors.text, fontSize: 17, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  profileMeta: { marginTop: 4, color: colors.muted, fontSize: 12, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
  input: {
    backgroundColor: '#F5FAFD',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: typography.fontFamily,
  },
  rowButtons: { flexDirection: 'row-reverse', gap: 10 },
  smallPrimaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.round, paddingVertical: 12, alignItems: 'center', ...shadows.soft },
  smallPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '900', fontFamily: typography.fontFamily },
  smallDangerButton: { flex: 1, backgroundColor: colors.dangerSoft, borderRadius: radius.round, paddingVertical: 12, alignItems: 'center' },
  smallDangerText: { color: colors.danger, fontSize: 13, fontWeight: '900', fontFamily: typography.fontFamily },
  message: { fontSize: 12, fontWeight: '800', fontFamily: typography.fontFamily, ...rtl.text },
  successMessage: { color: colors.success },
  errorMessage: { color: colors.danger },
  infoRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: colors.surfaceSoft, padding: 12, borderWidth: 1, borderColor: colors.borderSoft },
  infoIcon: { width: 38, height: 38, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dangerIcon: { backgroundColor: colors.dangerSoft },
  dangerText: { color: colors.danger },
  preferenceCopy: { flex: 1 },
  preferenceLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', fontFamily: typography.fontFamilyRegular, ...rtl.text },
  preferenceValue: { marginTop: 3, color: colors.text, fontSize: 13, fontWeight: '900', fontFamily: typography.fontFamilySemiBold, ...rtl.text },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.62 },
});
