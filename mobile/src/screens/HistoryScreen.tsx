import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { HistoryItem } from '../components/HistoryItem';
import { LineIcon } from '../components/LineIcon';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import { useResultsHistory } from '../state/ResultsHistoryContext';
import type { RootStackParamList } from '../../App';
import { usePools } from '../state/PoolsContext';
import { useTreatments } from '../state/TreatmentContext';
import { PoolPicker } from '../components/PoolPicker';
import { HistoryTrend } from '../components/HistoryTrend';
import { resultStatus } from '../domain/resultPresentation';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;
type HistoryFilter = 'all' | 'balanced' | 'needsCare';

export function HistoryScreen({ navigation }: Props) {
  const { historyRecords, refreshHistory, syncError, syncing } = useResultsHistory();
  const { pools } = usePools();
  const { getTreatment } = useTreatments();
  const [poolId, setPoolId] = useState<string>();
  const selectedPool =
    pools.find((pool) => pool.id === poolId) ?? (pools.length === 1 ? pools[0] : undefined);
  const [days, setDays] = useState(30);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>('all');

  useFocusEffect(
    useCallback(() => {
      refreshHistory();
    }, [refreshHistory]),
  );

  const scopedRecords = useMemo(
    () =>
      historyRecords.filter(
        (record) =>
          (!selectedPool ||
            record.poolId === selectedPool.id ||
            Boolean(selectedPool.cloudId && record.poolId === selectedPool.cloudId)) &&
          (!days || record.testedAt >= Date.now() - days * 86400000),
      ),
    [days, historyRecords, selectedPool],
  );
  const allHistoryItems = useMemo(
    () =>
      scopedRecords.map((record) => ({
        cloudId: record.cloudId,
        date: record.date,
        testId: record.testId,
        poolName: record.poolName,
        status: record.analysisResult
          ? resultStatus(record.analysisResult).label
          : 'בדיקה שמורה — פתח לפירוט',
        time: record.resultSummary,
        tone: resultStatus(record.analysisResult).tone,
      })),
    [scopedRecords],
  );

  const visibleHistoryItems = useMemo(() => {
    if (filter === 'balanced') return allHistoryItems.filter((item) => item.tone === 'success');
    if (filter === 'needsCare') return allHistoryItems.filter((item) => item.tone === 'warning');
    return allHistoryItems;
  }, [allHistoryItems, filter]);

  const filterLabel = filter === 'balanced' ? 'בטווח' : filter === 'needsCare' ? 'תשומת לב' : 'הכל';
  const periodLabel =
    days === 7
      ? 'שבוע אחרון'
      : days === 30
        ? 'חודש אחרון'
        : days === 90
          ? '3 חודשים'
          : 'כל הבדיקות השמורות';

  return (
    <AppShell activeTab="history" navigation={navigation}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="סינון בדיקות"
          accessibilityState={{ expanded: filterOpen }}
          onPress={() => setFilterOpen((open) => !open)}
          style={({ pressed }) => [styles.filter, pressed && styles.pressed]}
        >
          <LineIcon name="filter" color={colors.primaryDark} size={16} />
          <Text style={styles.filterText}>סינון</Text>
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>היסטוריית בדיקות</Text>
          <Text style={styles.subtitle}>הבדיקות והטיפולים שלך</Text>
        </View>
      </View>

      <PoolPicker
        pools={pools}
        selectedId={selectedPool?.id}
        onSelect={setPoolId}
        includeAll={pools.length > 1}
      />
      <Text style={styles.scopeNote}>
        {periodLabel} · {filterLabel} · {visibleHistoryItems.length} בדיקות
      </Text>
      {filterOpen ? (
        <View style={styles.filterPanel}>
          <Text style={styles.filterGroupLabel}>תקופה</Text>
          <View style={styles.filterRow}>
            {[
              { value: 7, label: 'שבוע' },
              { value: 30, label: 'חודש' },
              { value: 90, label: '3 חודשים' },
              { value: 0, label: 'הכל' },
            ].map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                selected={days === option.value}
                onPress={() => setDays(option.value)}
              />
            ))}
          </View>
          <Text style={styles.filterGroupLabel}>מצב המדדים</Text>
          <View style={styles.filterRow}>
            <FilterChip label="הכל" selected={filter === 'all'} onPress={() => setFilter('all')} />
            <FilterChip
              label="בטווח"
              selected={filter === 'balanced'}
              onPress={() => setFilter('balanced')}
            />
            <FilterChip
              label="תשומת לב"
              selected={filter === 'needsCare'}
              onPress={() => setFilter('needsCare')}
            />
          </View>
        </View>
      ) : null}
      {selectedPool ? (
        <HistoryTrend
          records={scopedRecords}
          onOpen={(testId) => navigation.navigate('Results', { testId })}
        />
      ) : (
        <View style={styles.trendHint}>
          <LineIcon name="results" color={colors.primaryDeep} size={16} />
          <Text style={styles.trendHintText}>בחר בריכה לצפייה במגמת המדדים</Text>
        </View>
      )}

      {syncError ? (
        <View style={styles.syncNotice}>
          <Text style={styles.syncNoticeTitle}>ההיסטוריה המקומית זמינה</Text>
          <Text style={styles.syncNoticeText}>{syncError}</Text>
        </View>
      ) : syncing ? (
        <View style={styles.syncStatus} accessibilityLiveRegion="polite">
          <LineIcon name="history" color={colors.textSoft} size={13} />
          <Text style={styles.syncStatusText}>מסנכרן היסטוריה...</Text>
        </View>
      ) : null}

      <View style={styles.timeline}>
        <View style={styles.timelineLine} />
        {visibleHistoryItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>אין בדיקות להצגה</Text>
            <Text style={styles.emptyText}>נסה לבחור סינון אחר או לבצע בדיקה חדשה.</Text>
          </View>
        ) : (
          visibleHistoryItems.map((item) => (
            <View key={item.testId}>
              <HistoryItem
                key={item.testId}
                date={item.date}
                onPress={() => navigation.navigate('Results', { testId: item.testId })}
                poolName={item.poolName}
                showPoolName={!selectedPool}
                status={item.status}
                time={item.time}
                tone={item.tone}
              />
              {getTreatment(item.testId) ? (
                <Text style={styles.treatmentNote}>
                  פעולה תועדה ·{' '}
                  {new Date(getTreatment(item.testId)!.performedAt).toLocaleDateString('he-IL')}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </View>
    </AppShell>
  );
}

function FilterChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filterChip, selected && styles.filterChipSelected]}
    >
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  syncStatus: { ...rtl.row, alignItems: 'center', gap: 6, marginTop: 12 },
  syncStatusText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    ...rtl.text,
  },
  scopeNote: {
    marginTop: 2,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    ...rtl.text,
  },
  filterGroupLabel: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    ...rtl.text,
  },
  filterRow: { ...rtl.row, gap: 6 },
  trendHint: { ...rtl.row, alignItems: 'center', gap: 5, paddingVertical: 10 },
  trendHintText: {
    flex: 1,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    ...rtl.text,
  },
  treatmentNote: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    marginTop: 6,
    marginRight: 12,
    ...rtl.text,
  },
  headerRow: {
    marginTop: 38,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 21,
    fontWeight: '900',
    ...rtl.text,
  },
  subtitle: {
    marginTop: 6,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '800',
    ...rtl.text,
  },
  filter: {
    minHeight: 42,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 13,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    ...shadows.soft,
  },
  filterText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  filterPanel: {
    marginTop: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    gap: 10,
  },
  syncNotice: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...shadows.soft,
  },
  syncNoticeTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.text,
  },
  syncNoticeText: {
    marginTop: 4,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 17,
    ...rtl.text,
  },
  filterChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 11,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  filterChipTextSelected: {
    color: colors.white,
  },
  timeline: {
    marginTop: 14,
    gap: 12,
    paddingRight: 12,
  },
  timelineLine: {
    position: 'absolute',
    top: 28,
    bottom: 28,
    right: 26,
    width: 2,
    borderRadius: 2,
    backgroundColor: '#144C7A',
    opacity: 0.9,
  },
  emptyCard: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 16,
    ...shadows.soft,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    fontWeight: '900',
    ...rtl.text,
  },
  emptyText: {
    marginTop: 5,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    ...rtl.text,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
