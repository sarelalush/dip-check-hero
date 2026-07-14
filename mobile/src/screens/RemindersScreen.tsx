import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { schedulePoolReminderTestNotification } from '../services/notificationService';
import { usePools, type Pool } from '../state/PoolsContext';
import { useReminders, type ReminderFrequency, type ReminderInfo } from '../state/ReminderContext';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Reminders'>;

const REMINDER_OPTIONS: Array<{ label: string; value: ReminderFrequency }> = [
  { label: 'כבוי', value: 'off' },
  { label: '3 שעות', value: 'every3h' },
  { label: '6 שעות', value: 'every6h' },
  { label: '12 שעות', value: 'every12h' },
  { label: 'יומי', value: 'daily' },
];

const FREQUENCY_MS: Record<Exclude<ReminderFrequency, 'off'>, number> = {
  every3h: 3 * 60 * 60 * 1000,
  every6h: 6 * 60 * 60 * 1000,
  every12h: 12 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

function reminderLabel(frequency: ReminderFrequency) {
  return REMINDER_OPTIONS.find((option) => option.value === frequency)?.label ?? 'כבוי';
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(1, Math.ceil(ms / (60 * 1000)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${totalMinutes} דקות`;
  if (minutes <= 0) return `${hours} שעות`;
  return `${hours} שעות ו-${minutes} דקות`;
}

function nextReminderText(info: ReminderInfo) {
  if (info.frequency === 'off') return 'התראה כבויה';
  if (info.error) return 'נדרשת הרשאת התראות';
  if (!info.updatedAt) return 'התראה פעילה';

  const interval = FREQUENCY_MS[info.frequency];
  const elapsed = Math.max(0, Date.now() - info.updatedAt);
  const remaining = interval - (elapsed % interval);
  return `הבאה בעוד ${formatDuration(remaining)}`;
}

export function RemindersScreen({ navigation }: Props) {
  const { pools } = usePools();
  const { getReminderInfo, hydrated, setReminder } = useReminders();
  const [savingPoolId, setSavingPoolId] = useState<string>();
  const [testPoolId, setTestPoolId] = useState<string>();
  const [messages, setMessages] = useState<Record<string, string>>({});

  const activeCount = useMemo(
    () => pools.filter((pool) => getReminderInfo(pool.id).frequency !== 'off').length,
    [getReminderInfo, pools],
  );

  async function updateReminder(pool: Pool, frequency: ReminderFrequency) {
    if (savingPoolId) return;

    setSavingPoolId(pool.id);
    setMessages((current) => ({ ...current, [pool.id]: '' }));
    try {
      await setReminder(pool.id, frequency, pool.name);
      setMessages((current) => ({
        ...current,
        [pool.id]: frequency === 'off' ? 'התזכורת כובתה.' : `התזכורת עודכנה: ${reminderLabel(frequency)}.`,
      }));
    } finally {
      setSavingPoolId(undefined);
    }
  }

  async function sendTestReminder(pool: Pool) {
    if (testPoolId) return;

    setTestPoolId(pool.id);
    setMessages((current) => ({ ...current, [pool.id]: '' }));
    try {
      const result = await schedulePoolReminderTestNotification(pool.name);
      setMessages((current) => ({
        ...current,
        [pool.id]: result.error ?? 'התראת בדיקה תופיע בעוד כ-10 שניות.',
      }));
    } finally {
      setTestPoolId(undefined);
    }
  }

  return (
    <AppShell activeTab="settings" navigation={navigation} contentStyle={styles.shellContent}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <LineIcon name="bell" color={colors.white} size={22} />
        </View>
        <Text style={styles.title}>תזכורות בדיקה</Text>
        <Text style={styles.subtitle}>בחר לכל בריכה מתי לקבל תזכורת לבצע בדיקת סטיק.</Text>
      </View>

      <Card compact style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeText}>{activeCount}</Text>
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>תזכורות פעילות</Text>
            <Text style={styles.summaryText}>
              {pools.length > 0 ? `${activeCount} מתוך ${pools.length} בריכות עם תזכורת` : 'אין בריכות פעילות כרגע'}
            </Text>
          </View>
        </View>
        {!hydrated ? <Text style={styles.loadingText}>טוען תזכורות מהמכשיר...</Text> : null}
      </Card>

      {pools.length === 0 ? (
        <Card compact style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>אין עדיין בריכות לניהול</Text>
          <Text style={styles.emptyText}>אחרי שתוסיף בריכה, תוכל להגדיר לה תזכורת מהירה מכאן.</Text>
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => navigation.navigate('AddPool')}>
            <LineIcon name="plus" color={colors.white} size={18} />
            <Text style={styles.primaryButtonText}>הוסף בריכה</Text>
          </Pressable>
        </Card>
      ) : (
        <View style={styles.poolList}>
          {pools.map((pool) => {
            const info = getReminderInfo(pool.id);
            return (
              <ReminderPoolCard
                key={pool.id}
                info={info}
                message={messages[pool.id]}
                onDetails={() => navigation.navigate('PoolDetails', { poolId: pool.id })}
                onTest={() => sendTestReminder(pool)}
                onUpdate={(frequency) => updateReminder(pool, frequency)}
                pool={pool}
                saving={savingPoolId === pool.id}
                testing={testPoolId === pool.id}
              />
            );
          })}
        </View>
      )}
    </AppShell>
  );
}

function ReminderPoolCard({
  info,
  message,
  onDetails,
  onTest,
  onUpdate,
  pool,
  saving,
  testing,
}: {
  info: ReminderInfo;
  message?: string;
  onDetails: () => void;
  onTest: () => void;
  onUpdate: (frequency: ReminderFrequency) => void;
  pool: Pool;
  saving: boolean;
  testing: boolean;
}) {
  const active = info.frequency !== 'off';
  const volume = `${pool.volumeLiters.toLocaleString('he-IL')} ליטר`;

  return (
    <Card compact style={styles.poolCard}>
      <View style={styles.poolHeader}>
        <View style={[styles.poolStatus, active ? styles.poolStatusActive : styles.poolStatusOff]}>
          <LineIcon name={active ? 'bell' : 'close'} color={active ? colors.primaryDark : colors.muted} size={14} />
          <Text style={[styles.poolStatusText, active && styles.poolStatusTextActive]}>
            {active ? reminderLabel(info.frequency) : 'כבוי'}
          </Text>
        </View>
        <View style={styles.poolTitleWrap}>
          <Text style={styles.poolName}>{pool.name}</Text>
          <Text style={styles.poolMeta}>{volume}</Text>
        </View>
      </View>

      <View style={styles.nextRow}>
        <LineIcon name="history" color={active ? colors.primaryDark : colors.muted} size={15} />
        <Text style={[styles.nextText, !active && styles.nextTextMuted]}>{nextReminderText(info)}</Text>
      </View>

      <View style={styles.optionsGrid}>
        {REMINDER_OPTIONS.map((option) => {
          const selected = info.frequency === option.value;
          return (
            <Pressable
              key={option.value}
              disabled={saving || testing}
              onPress={() => onUpdate(option.value)}
              style={({ pressed }) => [
                styles.optionButton,
                selected && styles.optionButtonSelected,
                (pressed || saving || testing) && styles.pressed,
              ]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Pressable disabled={saving || testing} onPress={onTest} style={({ pressed }) => [styles.testButton, pressed && styles.pressed]}>
          {testing ? <ActivityIndicator color={colors.primaryDark} size="small" /> : <LineIcon name="bell" color={colors.primaryDark} size={15} />}
          <Text style={styles.testButtonText}>בדיקת התראה</Text>
        </Pressable>
        <Pressable onPress={onDetails} style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}>
          <Text style={styles.detailsButtonText}>פרטי בריכה</Text>
          <LineIcon name="chevronLeft" color={colors.primaryDark} size={15} />
        </Pressable>
      </View>

      {saving ? <Text style={styles.cardMessage}>שומר תזכורת...</Text> : null}
      {message ? <Text style={[styles.cardMessage, info.error ? styles.errorText : null]}>{message}</Text> : null}
      {info.error ? <Text style={styles.errorText}>{info.error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  shellContent: {
    paddingHorizontal: 18,
  },
  header: {
    alignItems: 'center',
    marginTop: 6,
  },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...shadows.button,
  },
  title: {
    marginTop: 12,
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 26,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    marginTop: 6,
    color: colors.textSoft,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '800',
    ...rtl.textCenter,
  },
  summaryCard: {
    marginTop: 18,
    borderColor: 'rgba(8,175,203,0.18)',
  },
  summaryTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  summaryBadge: {
    width: 54,
    height: 54,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  summaryBadgeText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyBold,
    fontSize: 24,
    fontWeight: '900',
  },
  summaryCopy: {
    flex: 1,
  },
  summaryTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.text,
  },
  summaryText: {
    marginTop: 3,
    color: colors.textSoft,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '800',
    ...rtl.text,
  },
  loadingText: {
    marginTop: 9,
    color: colors.muted,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    ...rtl.text,
  },
  emptyCard: {
    marginTop: 16,
    gap: 10,
    alignItems: 'stretch',
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 17,
    fontWeight: '900',
    ...rtl.text,
  },
  emptyText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
    ...rtl.text,
  },
  primaryButton: {
    marginTop: 6,
    minHeight: 48,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
    ...shadows.button,
  },
  primaryButtonText: {
    color: colors.white,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
  },
  poolList: {
    marginTop: 14,
    gap: 12,
  },
  poolCard: {
    gap: 12,
  },
  poolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  poolTitleWrap: {
    flex: 1,
  },
  poolName: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    fontWeight: '900',
    ...rtl.text,
  },
  poolMeta: {
    marginTop: 3,
    color: colors.textSoft,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '800',
    ...rtl.text,
  },
  poolStatus: {
    minWidth: 78,
    minHeight: 32,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: 4,
    paddingHorizontal: 9,
  },
  poolStatusActive: {
    backgroundColor: colors.primarySoft,
  },
  poolStatusOff: {
    backgroundColor: colors.borderSoft,
  },
  poolStatusText: {
    color: colors.muted,
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    fontWeight: '900',
  },
  poolStatusTextActive: {
    color: colors.primaryDark,
  },
  nextRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  nextText: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.text,
  },
  nextTextMuted: {
    color: colors.muted,
  },
  optionsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    minWidth: 82,
    flexGrow: 1,
    borderRadius: radius.round,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.soft,
  },
  optionText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    fontWeight: '900',
  },
  optionTextSelected: {
    color: colors.white,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  testButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.round,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
  },
  testButtonText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    fontWeight: '900',
  },
  detailsButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.round,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: 4,
  },
  detailsButtonText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    fontWeight: '900',
  },
  cardMessage: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '800',
    ...rtl.text,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '800',
    ...rtl.text,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
