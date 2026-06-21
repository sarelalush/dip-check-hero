import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { HistoryItem } from '../components/HistoryItem';
import { LineIcon } from '../components/LineIcon';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import { useResultsHistory } from '../state/ResultsHistoryContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;
type HistoryFilter = 'all' | 'balanced' | 'needsCare';

export function HistoryScreen({ navigation }: Props) {
  const { historyRecords } = useResultsHistory();
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>('all');

  const allHistoryItems = useMemo(
    () =>
      historyRecords.map((record) => ({
        cloudId: record.cloudId,
        date: record.date,
        testId: record.testId,
        poolName: record.poolName,
        status: record.status,
        time: record.resultSummary,
        tone: record.tone,
      })),
    [historyRecords],
  );

  const visibleHistoryItems = useMemo(() => {
    if (filter === 'balanced') return allHistoryItems.filter((item) => item.tone === 'success');
    if (filter === 'needsCare') return allHistoryItems.filter((item) => item.tone !== 'success');
    return allHistoryItems;
  }, [allHistoryItems, filter]);

  const filterLabel = filter === 'balanced' ? 'מאוזנים' : filter === 'needsCare' ? 'דורשים תיקון' : 'הכל';

  return (
    <AppShell activeTab="history" navigation={navigation}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => setFilterOpen((open) => !open)} style={({ pressed }) => [styles.filter, pressed && styles.pressed]}>
          <LineIcon name="filter" color={colors.primaryDark} size={16} />
          <Text style={styles.filterText}>סינון: {filterLabel}</Text>
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>היסטוריית בדיקות</Text>
          <Text style={styles.subtitle}>מעקב קצר ונקי אחרי כל סריקה</Text>
        </View>
      </View>

      {filterOpen ? (
        <View style={styles.filterPanel}>
          <FilterChip label="הכל" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterChip label="מים מאוזנים" selected={filter === 'balanced'} onPress={() => setFilter('balanced')} />
          <FilterChip label="נדרש תיקון" selected={filter === 'needsCare'} onPress={() => setFilter('needsCare')} />
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
            <HistoryItem
              key={item.testId}
              date={item.date}
              onPress={() => navigation.navigate('Results', { testId: item.cloudId ?? item.testId })}
              poolName={item.poolName}
              status={item.status}
              time={item.time}
              tone={item.tone}
            />
          ))
        )}
      </View>
    </AppShell>
  );
}

function FilterChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, selected && styles.filterChipSelected]}>
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    marginTop: 14,
    flexDirection: 'row-reverse',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    minHeight: 36,
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
    marginTop: 22,
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
