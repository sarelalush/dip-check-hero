import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { HistoryItem } from '../components/HistoryItem';
import { LineIcon } from '../components/LineIcon';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import { historyItems } from '../data/mockAppData';
import { useResultsHistory } from '../state/ResultsHistoryContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export function HistoryScreen({ navigation }: Props) {
  const { historyRecords } = useResultsHistory();
  const visibleHistoryItems =
    historyRecords.length > 0
      ? historyRecords.map((record) => ({
          date: record.date,
          poolName: record.poolName,
          status: record.status,
          time: `${record.poolName} · ${record.resultSummary}`,
          tone: record.tone,
        }))
      : historyItems;

  return (
    <AppShell activeTab="history" navigation={navigation}>
      <View style={styles.headerRow}>
        <Pressable style={({ pressed }) => [styles.filter, pressed && styles.pressed]}>
          <LineIcon name="filter" color={colors.primaryDark} size={16} />
          <Text style={styles.filterText}>סינון</Text>
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>היסטוריית בדיקות</Text>
          <Text style={styles.subtitle}>מעקב קצר ונקי אחרי כל סריקה</Text>
        </View>
      </View>

      <View style={styles.timeline}>
        <View style={styles.timelineLine} />
        {visibleHistoryItems.map((item) => (
          <HistoryItem
            key={`${item.date}-${item.time}`}
            date={item.date}
            poolName={item.poolName}
            status={item.status}
            time={item.time}
            tone={item.tone}
          />
        ))}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginTop: 20,
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
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
