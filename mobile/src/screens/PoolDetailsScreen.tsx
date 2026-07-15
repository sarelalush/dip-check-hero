import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { PrimaryButton } from '../components/PrimaryButton';
import { StatusBadge } from '../components/StatusBadge';
import { PoolPhoto } from '../components/WaterVisuals';
import { getBrand } from '../config/stripBrands';
import { getPoolShapeLabel, getPoolTypeLabel } from '../domain/pool';
import { colors, rtl, typography } from '../theme';
import { usePools } from '../state/PoolsContext';
import { useReminders, type ReminderFrequency } from '../state/ReminderContext';
import { useResultsHistory, type SavedHistoryRecord } from '../state/ResultsHistoryContext';
import { useScanSession } from '../state/ScanSessionContext';
import { schedulePoolReminderTestNotification } from '../services/notificationService';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PoolDetails'>;

const REMINDER_OPTIONS: Array<{ label: string; value: ReminderFrequency }> = [
  { label: 'כבוי', value: 'off' },
  { label: 'כל 3 שעות', value: 'every3h' },
  { label: 'כל 6 שעות', value: 'every6h' },
  { label: 'כל 12 שעות', value: 'every12h' },
  { label: 'יומי', value: 'daily' },
];

function reminderLabel(frequency: ReminderFrequency) {
  return REMINDER_OPTIONS.find((option) => option.value === frequency)?.label ?? 'כבוי';
}

export function PoolDetailsScreen({ navigation, route }: Props) {
  const { deletePool, getPool } = usePools();
  const { getReminder, getReminderError, setReminder } = useReminders();
  const { getPoolHistoryRecords } = useResultsHistory();
  const { startScanSession } = useScanSession();
  const pool = getPool(route.params.poolId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [testReminderStatus, setTestReminderStatus] = useState('');
  const recentTests = pool ? getPoolHistoryRecords(pool.id, 3) : [];
  const reminder = pool ? getReminder(pool.id) : 'off';
  const reminderError = pool ? getReminderError(pool.id) : undefined;
  const poolName = pool?.name ?? 'בריכה ללא שם';
  const poolVolume = pool ? `${pool.volumeLiters.toLocaleString('he-IL')} ליטר` : 'לא הוגדר נפח';
  const brand = getBrand(pool?.stripBrandId);
  const typeLabel = pool ? getPoolTypeLabel(pool.type) : 'כלור רגיל';
  const shapeLabel = pool?.volumeEntryMethod === 'manual' ? 'נפח ידני' : getPoolShapeLabel(pool?.shape);
  const tabletsLabel = pool?.tabletsActive ? `${pool.tabletsCount ?? 1} טבליות · ${pool.tabletWeightGrams ?? 200} גרם` : 'אין טבליות פעילות';
  const coverUri = pool?.imageUri ?? pool?.imageUrl;

  function handleDelete() {
    if (!pool) return;
    Alert.alert('מחיקת בריכה', `למחוק את ${pool.name}?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: () => {
          deletePool(pool.id);
          navigation.navigate('Pools');
        },
      },
    ]);
  }

  function startPoolScan() {
    const selectedBrand = pool?.stripBrandId ? getBrand(pool.stripBrandId) : undefined;
    const canSkipStripSelection = Boolean(selectedBrand?.supported);

    startScanSession({ brandId: canSkipStripSelection ? selectedBrand?.id : pool?.stripBrandId, poolId: route.params.poolId });
    if (canSkipStripSelection) {
      navigation.navigate('Scan', { brandId: selectedBrand?.id, poolId: route.params.poolId });
      return;
    }

    navigation.navigate('SelectStrip', { poolId: route.params.poolId });
  }

  async function handleReminderChange(frequency: ReminderFrequency) {
    if (!pool || reminderSaving) return;

    setReminderSaving(true);
    setTestReminderStatus('');
    try {
      await setReminder(pool.id, frequency, pool.name);
    } finally {
      setReminderSaving(false);
    }
  }

  async function handleTestReminder() {
    if (!pool || reminderSaving) return;

    setReminderSaving(true);
    setTestReminderStatus('');
    try {
      const result = await schedulePoolReminderTestNotification(pool.name);
      setTestReminderStatus(result.error ?? 'התראת בדיקה נשלחה ותופיע בעוד כ־10 שניות.');
    } finally {
      setReminderSaving(false);
    }
  }

  return (
    <AppShell activeTab="pools" navigation={navigation}>
      <View style={styles.header}>
        <Text style={styles.title}>{poolName}</Text>
        <Text style={styles.subtitle}>פרטי בריכה ובדיקה אחרונה</Text>
      </View>

      <View style={styles.photo}>
        {coverUri ? <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" /> : <PoolPhoto variant="villa" />}
      </View>

      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <StatusBadge label="המים מאוזנים" tone="success" />
          <View style={styles.iconBubble}>
            <LineIcon name="pools" color={colors.primaryDark} size={20} />
          </View>
        </View>
        <Text style={styles.metaLabel}>נפח</Text>
        <Text style={styles.metaValue}>{poolVolume}</Text>
        <View style={styles.detailsGrid}>
          <DetailPill label="סוג" value={typeLabel} />
          <DetailPill label="צורה" value={shapeLabel} />
          <DetailPill label="סטיק" value={brand.nameHe} />
          <DetailPill label="משאבה" value={`${pool?.pumpHoursPerDay ?? 8} שעות ביום`} />
          <DetailPill label="בדיקה חוזרת" value={`${pool?.retestHours ?? 6} שעות`} />
          <DetailPill label="טבליות" value={tabletsLabel} />
        </View>
        {pool?.notes ? <Text style={styles.notes}>{pool.notes}</Text> : null}
        {pool?.imageUploadError ? <Text style={styles.warningText}>{pool.imageUploadError}</Text> : null}
        <Text style={styles.description}>בחר סטיק בדיקה כדי להתחיל סריקה עבור הבריכה הזו.</Text>
      </Card>

      <View style={styles.cta}>
        <PrimaryButton
          label="התחל סריקה"
          icon="scan"
          onPress={startPoolScan}
        />
      </View>

      {pool ? (
        <Card compact style={styles.reminderCard}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>תזכורת לבדיקה</Text>
            <LineIcon name="bell" color={colors.primaryDark} size={16} />
          </View>
          <Text style={styles.reminderDescription}>בחר מתי לקבל תזכורת לבדוק שוב את הבריכה הזו.</Text>
          <View style={styles.reminderOptions}>
            {REMINDER_OPTIONS.map((option) => {
              const active = reminder === option.value;
              return (
                <Pressable
                  key={option.value}
                  disabled={reminderSaving}
                  onPress={() => handleReminderChange(option.value)}
                  style={({ pressed }) => [
                    styles.reminderOption,
                    active && styles.reminderOptionActive,
                    (pressed || reminderSaving) && styles.reminderOptionPressed,
                  ]}
                >
                  <Text style={[styles.reminderOptionText, active && styles.reminderOptionTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.reminderStatus}>
            {reminderSaving ? 'מעדכן תזכורת...' : reminder === 'off' ? 'התזכורת כבויה לבריכה הזו.' : `תזכורת פעילה: ${reminderLabel(reminder)}.`}
          </Text>
          <Pressable
            disabled={reminderSaving}
            onPress={handleTestReminder}
            style={({ pressed }) => [styles.testReminderButton, (pressed || reminderSaving) && styles.reminderOptionPressed]}
          >
            <Text style={styles.testReminderText}>שלח בדיקת התראה בעוד 10 שניות</Text>
          </Pressable>
          {testReminderStatus ? <Text style={styles.reminderStatus}>{testReminderStatus}</Text> : null}
          {reminderError ? <Text style={styles.warningText}>{reminderError}</Text> : null}
        </Card>
      ) : null}

      <Card compact style={styles.recentCard}>
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>בדיקות אחרונות</Text>
          <LineIcon name="history" color={colors.primaryDark} size={16} />
        </View>
        {recentTests.length === 0 ? (
          <Text style={styles.emptyHistory}>עדיין אין בדיקות שמורות לבריכה הזו.</Text>
        ) : (
          <View style={styles.recentList}>
            {recentTests.map((record) => (
              <RecentTestItem
                key={record.testId}
                record={record}
                onPress={() => navigation.navigate('Results', { testId: record.testId })}
              />
            ))}
          </View>
        )}
      </Card>

      {pool ? (
        <View style={styles.actions}>
          <Pressable onPress={() => navigation.navigate('EditPool', { poolId: pool.id })} style={styles.editButton}>
            <Text style={styles.editText}>עריכת בריכה</Text>
          </Pressable>
          <Pressable onPress={() => setConfirmDelete(true)} style={styles.deleteButton}>
            <Text style={styles.deleteText}>מחיקת בריכה</Text>
          </Pressable>
        </View>
      ) : null}

      {pool && confirmDelete ? (
        <Card compact style={styles.deleteConfirmCard}>
          <Text style={styles.deleteConfirmTitle}>למחוק את הבריכה?</Text>
          <Text style={styles.deleteConfirmText}>הבריכה "{pool.name}" תוסר מהמכשיר ומהענן אם יש חיבור פעיל. פעולה זו לא תמחק בדיקות שכבר נשמרו בהיסטוריה.</Text>
          <View style={styles.deleteConfirmActions}>
            <Pressable onPress={() => setConfirmDelete(false)} style={styles.cancelDeleteButton}>
              <Text style={styles.cancelDeleteText}>ביטול</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                deletePool(pool.id);
                navigation.navigate('Pools');
              }}
              style={styles.confirmDeleteButton}
            >
              <Text style={styles.confirmDeleteText}>מחיקה</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}
    </AppShell>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailPill}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function RecentTestItem({ onPress, record }: { onPress: () => void; record: SavedHistoryRecord }) {
  const statusColor = record.tone === 'success' ? colors.success : colors.warning;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.recentItem, pressed && styles.recentItemPressed]}>
      <View style={[styles.recentDot, { backgroundColor: statusColor }]} />
      <View style={styles.recentCopy}>
        <Text style={styles.recentDate}>{record.date}</Text>
        <Text style={styles.recentStatus}>{record.status}</Text>
        <Text style={styles.recentSummary} numberOfLines={1}>
          {record.resultSummary}
        </Text>
      </View>
      <LineIcon name="chevronLeft" color={colors.muted} size={17} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 18,
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    marginTop: 5,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '700',
    ...rtl.textCenter,
  },
  photo: {
    height: 156,
    borderRadius: 16,
    marginTop: 18,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  card: {
    marginTop: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLabel: {
    marginTop: 6,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '700',
    ...rtl.text,
  },
  metaValue: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 24,
    fontWeight: '900',
    ...rtl.text,
  },
  detailsGrid: {
    marginTop: 8,
    gap: 8,
  },
  detailPill: {
    borderRadius: 16,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  detailLabel: {
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 11,
    fontWeight: '800',
    ...rtl.text,
  },
  detailValue: {
    marginTop: 2,
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.text,
  },
  notes: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    ...rtl.text,
  },
  warningText: {
    color: colors.warning,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    ...rtl.text,
  },
  description: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    ...rtl.text,
  },
  cta: {
    marginTop: 16,
  },
  reminderCard: {
    marginTop: 16,
    gap: 10,
  },
  reminderDescription: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
    ...rtl.text,
  },
  reminderOptions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderOption: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  reminderOptionPressed: {
    opacity: 0.75,
  },
  reminderOptionText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  reminderOptionTextActive: {
    color: colors.white,
  },
  reminderStatus: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.text,
  },
  testReminderButton: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  testReminderText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  recentCard: {
    marginTop: 16,
    gap: 10,
  },
  recentHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.text,
  },
  emptyHistory: {
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
    ...rtl.text,
  },
  recentList: {
    gap: 8,
  },
  recentItem: {
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  recentItemPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  recentDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  recentCopy: {
    flex: 1,
  },
  recentDate: {
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.text,
  },
  recentStatus: {
    marginTop: 2,
    color: colors.textSoft,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 11,
    fontWeight: '900',
    ...rtl.text,
  },
  recentSummary: {
    marginTop: 2,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    fontWeight: '800',
    ...rtl.text,
  },
  actions: {
    marginTop: 10,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 18,
  },
  editButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  editText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteText: {
    color: colors.danger,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  deleteConfirmCard: {
    marginTop: 10,
    gap: 10,
    borderColor: 'rgba(231,92,98,0.26)',
    backgroundColor: colors.dangerSoft,
  },
  deleteConfirmTitle: {
    color: colors.danger,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.text,
  },
  deleteConfirmText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
    ...rtl.text,
  },
  deleteConfirmActions: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  cancelDeleteButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelDeleteText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
  },
  confirmDeleteButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteText: {
    color: colors.white,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
  },
});
