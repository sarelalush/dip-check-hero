import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabBar } from '../components/BottomTabBar';
import { LineIcon, type LineIconName } from '../components/LineIcon';
import { getRecommendedBrand } from '../config/stripBrands';
import { useAppPreferences } from '../state/AppPreferencesContext';
import { useAuth } from '../state/AuthContext';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
type UnitsPreference = 'liters' | 'cubic';

const UNITS_KEY = '@aquasense/preferences/volume-units';

export function SettingsScreen({ navigation }: Props) {
  const { showTechnicalAnalysisDetails, setShowTechnicalAnalysisDetails } = useAppPreferences();
  const { user, signOut, updateDisplayName } = useAuth();
  const [busy, setBusy] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [message, setMessage] = useState('');
  const [unitsPreference, setUnitsPreference] = useState<UnitsPreference>('liters');

  const displayName = useMemo(() => {
    return (
      (user?.user_metadata?.display_name as string | undefined) ||
      (user?.user_metadata?.full_name as string | undefined) ||
      user?.email ||
      'משתמש Dip Check'
    );
  }, [user]);

  const [nameInput, setNameInput] = useState(displayName);
  const email = user?.email ?? 'לא מחובר';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'ד';
  const recommendedBrand = getRecommendedBrand();

  useEffect(() => {
    setNameInput(displayName);
  }, [displayName]);

  useEffect(() => {
    let mounted = true;

    async function restorePreferences() {
      try {
        const storedUnits = await AsyncStorage.getItem(UNITS_KEY);
        if (!mounted) return;
        setUnitsPreference(storedUnits === 'cubic' ? 'cubic' : 'liters');
      } catch (error) {
        console.warn('Failed to restore settings preferences', error);
      }
    }

    restorePreferences();

    return () => {
      mounted = false;
    };
  }, []);

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

  async function setUnits(nextUnits: UnitsPreference) {
    setUnitsPreference(nextUnits);
    try {
      await AsyncStorage.setItem(UNITS_KEY, nextUnits);
    } catch (error) {
      console.warn('Failed to save units preference', error);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.blob} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>התאמה אישית</Text>
        <Text style={styles.title}>הגדרות</Text>
        <Text style={styles.subtitle}>ניהול חשבון, מנוי, העדפות סריקה ותמיכה באפליקציה.</Text>

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
              <Text style={styles.smallDangerText}>{busy ? 'יוצא...' : 'יציאה מהחשבון'}</Text>
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

        <Section title="העדפות אפליקציה">
          <SettingsRow
            icon="history"
            label="תזכורות"
            value="הגדרה לפי בריכה במסך פרטי הבריכה"
            onPress={() => navigation.navigate('Pools')}
          />
          <InfoRow icon="scan" label="סטיק ברירת מחדל" value={recommendedBrand.nameHe} />
          <ToggleRow
            enabled={showTechnicalAnalysisDetails}
            icon="settings"
            label="הצגת פרטים טכניים בתוצאות"
            value="מציג מקור ניתוח וביטחון רק כשהאפשרות פעילה"
            onToggle={() => setShowTechnicalAnalysisDetails(!showTechnicalAnalysisDetails)}
          />
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceLabel}>יחידות נפח</Text>
              <Text style={styles.preferenceValue}>{unitsPreference === 'liters' ? 'ליטרים' : 'קוב'}</Text>
            </View>
            <View style={styles.segmented}>
              <SegmentButton label="ליטרים" selected={unitsPreference === 'liters'} onPress={() => setUnits('liters')} />
              <SegmentButton label="קוב" selected={unitsPreference === 'cubic'} onPress={() => setUnits('cubic')} />
            </View>
          </View>
          <InfoRow icon="help" label="שפה" value="עברית · בקרוב אפשרויות נוספות" muted />
        </Section>

        <Section title="עזרה ומשפטי">
          <SettingsRow icon="help" label="עזרה ותמיכה" value="שאלות נפוצות ויצירת קשר" onPress={() => navigation.navigate('Support')} />
          <SettingsRow icon="results" label="מדיניות פרטיות" value="איזה מידע נשמר ואיך משתמשים בו" onPress={() => navigation.navigate('PrivacyPolicy')} />
          <SettingsRow icon="history" label="תנאי שימוש" value="המלצות, אחריות ושימוש בטוח" onPress={() => navigation.navigate('Terms')} />
        </Section>

        <Section title="מוכנות לפרסום">
          <SettingsRow
            icon="scan"
            label="בדיקת חיבור"
            value="בדיקת Supabase, session, RPC ו-Storage על מכשיר אמיתי"
            onPress={() => navigation.navigate('ConnectionDiagnostics')}
          />
          <SettingsRow
            icon="check"
            label="בדיקות לפני פרסום"
            value="רשימת מצב פנימית לפני App Store"
            onPress={() => navigation.navigate('ReleaseChecklist')}
          />
        </Section>
      </ScrollView>
      <BottomTabBar active="settings" navigation={navigation} />
    </View>
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

function InfoRow({ icon, label, muted, value }: { icon: LineIconName; label: string; muted?: boolean; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <LineIcon name={icon} color={muted ? colors.muted : colors.primaryDark} size={18} />
      </View>
      <View style={styles.preferenceCopy}>
        <Text style={styles.preferenceLabel}>{label}</Text>
        <Text style={[styles.preferenceValue, muted && styles.mutedText]} numberOfLines={2}>
          {value}
        </Text>
      </View>
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

function ToggleRow({
  enabled,
  icon,
  label,
  onToggle,
  value,
}: {
  enabled: boolean;
  icon: LineIconName;
  label: string;
  onToggle: () => void;
  value: string;
}) {
  return (
    <Pressable onPress={onToggle} style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}>
      <View style={styles.infoIcon}>
        <LineIcon name={icon} color={colors.primaryDark} size={18} />
      </View>
      <View style={styles.preferenceCopy}>
        <Text style={styles.preferenceLabel}>{label}</Text>
        <Text style={styles.preferenceValue} numberOfLines={2}>{value}</Text>
      </View>
      <View style={[styles.switch, enabled && styles.switchOn]}>
        <View style={[styles.switchKnob, enabled && styles.switchKnobOn]} />
      </View>
    </Pressable>
  );
}

function SegmentButton({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, selected && styles.segmentButtonSelected]}>
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
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
  preferenceRow: { gap: 10, borderRadius: 16, backgroundColor: colors.surfaceSoft, padding: 12, borderWidth: 1, borderColor: colors.borderSoft },
  preferenceCopy: { flex: 1 },
  preferenceLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', fontFamily: typography.fontFamilyRegular, ...rtl.text },
  preferenceValue: { marginTop: 3, color: colors.text, fontSize: 13, fontWeight: '900', fontFamily: typography.fontFamilySemiBold, ...rtl.text },
  mutedText: { color: colors.muted },
  segmented: { flexDirection: 'row-reverse', gap: 8 },
  segmentButton: { flex: 1, borderRadius: radius.round, paddingVertical: 9, alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderSoft },
  segmentButtonSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { color: colors.textSoft, fontSize: 12, fontWeight: '900', fontFamily: typography.fontFamilySemiBold },
  segmentTextSelected: { color: colors.white },
  switch: { width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: colors.borderStrong, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.primary },
  switchKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, alignSelf: 'flex-start' },
  switchKnobOn: { alignSelf: 'flex-end' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.62 },
});
