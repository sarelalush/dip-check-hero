import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader } from '../components/AppHeader';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { LineIcon, type LineIconName } from '../components/LineIcon';
import { colors, radius, rtl, shadows, typography } from '../theme';
import type { StatusTone } from '../components/StatusBadge';
import type { Pool } from '../domain/pool';
import type { ScanResultParameter } from '../domain/scanResults';
import { useStartScanFlow } from '../hooks/useStartScanFlow';
import { usePools } from '../state/PoolsContext';
import { useResultsHistory, type SavedHistoryRecord } from '../state/ResultsHistoryContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Pools'>;
const POOL_FALLBACK_IMAGE = require('../../assets/images/home-pool.png');

interface PoolMetric {
  icon: LineIconName;
  label: string;
  status: string;
  tone: StatusTone;
  value: string;
}

function formatVolume(liters: number) {
  if (!liters || liters <= 0) return 'נפח לא הוגדר';
  return `${Math.round(liters).toLocaleString('he-IL')} ליטר`;
}

function formatMetricValue(parameter?: ScanResultParameter) {
  if (!parameter) return '-';
  return parameter.key === 'ph' ? parameter.value.toFixed(1) : Math.round(parameter.value).toLocaleString('he-IL');
}

function getMetric(
  parameters: ScanResultParameter[] | undefined,
  keys: ScanResultParameter['key'][],
  label: string,
  icon: LineIconName,
): PoolMetric {
  const parameter = parameters?.find((item) => keys.includes(item.key));
  return {
    icon,
    label: parameter?.name ?? label,
    status: parameter?.status.label ?? 'אין נתון',
    tone: parameter?.status.tone ?? 'neutral',
    value: formatMetricValue(parameter),
  };
}

function toneColor(tone: StatusTone) {
  if (tone === 'success') return colors.success;
  if (tone === 'danger') return colors.danger;
  if (tone === 'warning') return '#F47D13';
  return colors.primaryDark;
}

function toneBackground(tone: StatusTone) {
  if (tone === 'success') return colors.successSoft;
  if (tone === 'danger') return colors.dangerSoft;
  if (tone === 'warning') return colors.warningSoft;
  return colors.primarySoft;
}

function getPoolSnapshot(pool: Pool, latestRecord?: SavedHistoryRecord) {
  const parameters = latestRecord?.analysisResult?.parameters;
  return {
    lastTest: latestRecord ? `עודכן ${latestRecord.date}` : 'עדיין לא בוצעה בדיקה',
    metrics: [
      getMetric(parameters, ['ph'], 'pH', 'drop'),
      getMetric(parameters, ['freeChlorine', 'totalChlorine'], 'כלור', 'help'),
      getMetric(parameters, ['alkalinity'], 'אלקליניות', 'results'),
    ],
    status: latestRecord?.status ?? 'מוכן לבדיקה',
    tone: latestRecord?.tone ?? ('neutral' as StatusTone),
    volume: formatVolume(pool.volumeLiters),
  };
}

export function PoolsScreen({ navigation }: Props) {
  const { pools } = usePools();
  const { getPoolHistoryRecords } = useResultsHistory();
  const startScanFlow = useStartScanFlow(navigation);

  return (
    <AppShell activeTab="pools" navigation={navigation}>
      <View pointerEvents="none" style={styles.waterHeader}>
        <View style={styles.waterCircleOne} />
        <View style={styles.waterCircleTwo} />
      </View>

      <AppHeader />

      <View style={styles.header}>
        <Text style={styles.title}>הבריכות שלי</Text>
        <Text style={styles.subtitle}>בחר בריכה לבדיקה או ניהול</Text>
      </View>

      <View style={styles.list}>
        {pools.length > 0 ? (
          pools.map((pool, index) => {
            const latestRecord = getPoolHistoryRecords(pool.id, 1)[0];
            const snapshot = getPoolSnapshot(pool, latestRecord);
            return index === 0 ? (
              <FeaturedPoolCard
                key={pool.id}
                pool={pool}
                snapshot={snapshot}
                onOpen={() => navigation.navigate('PoolDetails', { poolId: pool.id })}
                onScan={() => startScanFlow(pool.id)}
              />
            ) : (
              <CompactPoolCard
                key={pool.id}
                pool={pool}
                snapshot={snapshot}
                onOpen={() => navigation.navigate('PoolDetails', { poolId: pool.id })}
              />
            );
          })
        ) : (
          <Card compact style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <LineIcon name="pools" color={colors.primaryDark} size={28} />
            </View>
            <Text style={styles.emptyTitle}>עדיין אין בריכות</Text>
            <Text style={styles.emptyText}>הוסף בריכה ראשונה כדי להתחיל בדיקות, לעקוב אחרי מצב המים ולקבל המלצות לפי נפח הבריכה.</Text>
          </Card>
        )}
      </View>

      <AddPoolButton onPress={() => navigation.navigate('AddPool')} />
      <Text style={styles.addHint}>אפשר להוסיף כמה בריכות ולנהל כל אחת בנפרד</Text>
    </AppShell>
  );
}

function FeaturedPoolCard({
  onOpen,
  onScan,
  pool,
  snapshot,
}: {
  onOpen: () => void;
  onScan: () => void;
  pool: Pool;
  snapshot: ReturnType<typeof getPoolSnapshot>;
}) {
  const hasCustomImage = Boolean(pool.imageUri || pool.imageUrl);
  const imageSource = hasCustomImage ? { uri: pool.imageUri ?? pool.imageUrl } : POOL_FALLBACK_IMAGE;

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.featuredCard, pressed && styles.pressed]}>
      <View style={styles.featuredTop}>
        <View style={styles.featuredImageWrap}>
          <ImageBackground source={imageSource} resizeMode="cover" style={styles.featuredImage} imageStyle={hasCustomImage ? styles.poolImageNatural : styles.poolImageFocus}>
            <View style={styles.imageShade} />
            <View style={styles.moreDots}>
              <LineIcon name="more" color={colors.textSoft} size={18} />
            </View>
          </ImageBackground>
        </View>

        <View style={styles.featuredInfo}>
          <View style={styles.primaryBadge}>
            <LineIcon name="check" color={colors.white} size={14} />
            <Text style={styles.primaryBadgeText}>בריכה ראשית</Text>
          </View>
          <Text style={styles.poolName}>{pool.name}</Text>
          <InfoLine icon="drop" text={snapshot.volume} />
          <InfoLine icon="history" text={snapshot.lastTest} />
          <StatusPill status={snapshot.status} tone={snapshot.tone} />
        </View>
      </View>

      <View style={styles.metricRow}>
        {snapshot.metrics.map((metric) => (
          <MetricPill key={metric.label} metric={metric} />
        ))}
      </View>

      <View style={styles.featuredActions}>
        <Pressable onPress={onScan} style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}>
          <LineIcon name="scan" color={colors.white} size={21} />
          <Text style={styles.scanButtonText}>בדוק עכשיו</Text>
        </Pressable>
        <LineIcon name="chevronLeft" color={colors.text} size={24} />
      </View>
    </Pressable>
  );
}

function CompactPoolCard({
  onOpen,
  pool,
  snapshot,
}: {
  onOpen: () => void;
  pool: Pool;
  snapshot: ReturnType<typeof getPoolSnapshot>;
}) {
  const hasCustomImage = Boolean(pool.imageUri || pool.imageUrl);
  const imageSource = hasCustomImage ? { uri: pool.imageUri ?? pool.imageUrl } : POOL_FALLBACK_IMAGE;

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.compactCard, pressed && styles.pressed]}>
      <LineIcon name="chevronLeft" color={colors.text} size={24} />
      <View style={styles.compactInfo}>
        <Text style={styles.compactName}>{pool.name}</Text>
        <InfoLine icon="drop" text={snapshot.volume} />
        <InfoLine icon="history" text={snapshot.lastTest} />
        <StatusPill status={snapshot.status} tone={snapshot.tone} compact />
      </View>
      <ImageBackground source={imageSource} resizeMode="cover" style={styles.compactImage} imageStyle={hasCustomImage ? styles.poolImageNatural : styles.poolImageFocus}>
        <View style={styles.compactImageShade} />
        <View style={styles.compactDots}>
          <LineIcon name="more" color={colors.white} size={17} />
        </View>
      </ImageBackground>
    </Pressable>
  );
}

function InfoLine({ icon, text }: { icon: LineIconName; text: string }) {
  return (
    <View style={styles.infoLine}>
      <LineIcon name={icon} color={colors.primaryDark} size={17} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

function StatusPill({ compact = false, status, tone }: { compact?: boolean; status: string; tone: StatusTone }) {
  return (
    <View style={[styles.statusPill, compact && styles.statusPillCompact, { backgroundColor: toneBackground(tone), borderColor: toneColor(tone) }]}>
      <Text style={[styles.statusText, { color: toneColor(tone) }]}>{status}</Text>
      <LineIcon name={tone === 'success' ? 'check' : tone === 'warning' ? 'help' : 'drop'} color={toneColor(tone)} size={15} />
    </View>
  );
}

function MetricPill({ metric }: { metric: PoolMetric }) {
  return (
    <View style={styles.metricPill}>
      <View style={styles.metricHeader}>
        <LineIcon name={metric.icon} color={colors.primaryDark} size={20} />
        <Text style={styles.metricLabel}>{metric.label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: toneColor(metric.tone) }]}>{metric.value}</Text>
      <Text style={[styles.metricStatus, { color: toneColor(metric.tone) }]}>{metric.status}</Text>
    </View>
  );
}

function AddPoolButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.addPoolButton, pressed && styles.pressed]}>
      <View style={styles.addCircle}>
        <LineIcon name="plus" color={colors.white} size={23} />
      </View>
      <Text style={styles.addText}>הוסף בריכה חדשה</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: 8,
    zIndex: 2,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    ...rtl.textCenter,
  },
  subtitle: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
    ...rtl.textCenter,
  },
  waterHeader: {
    backgroundColor: 'rgba(217,247,252,0.72)',
    borderBottomLeftRadius: 42,
    borderBottomRightRadius: 42,
    height: 172,
    left: -20,
    overflow: 'hidden',
    position: 'absolute',
    right: -20,
    top: 34,
  },
  waterCircleOne: {
    backgroundColor: 'rgba(255,255,255,0.36)',
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 120,
    borderWidth: 2,
    height: 240,
    position: 'absolute',
    right: -48,
    top: 12,
    width: 240,
  },
  waterCircleTwo: {
    backgroundColor: 'rgba(8,175,203,0.10)',
    borderColor: 'rgba(255,255,255,0.42)',
    borderRadius: 130,
    borderWidth: 2,
    height: 260,
    left: -92,
    position: 'absolute',
    top: 72,
    width: 260,
  },
  list: {
    gap: 14,
    marginTop: 18,
  },
  featuredCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 12,
    ...shadows.hero,
  },
  featuredTop: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  featuredImageWrap: {
    borderRadius: 16,
    flex: 1.08,
    height: 146,
    overflow: 'hidden',
  },
  featuredImage: {
    flex: 1,
  },
  poolImageFocus: {
    transform: [{ translateY: -92 }],
  },
  poolImageNatural: {
    transform: [{ translateY: 0 }],
  },
  imageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  moreDots: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    top: 7,
    width: 28,
  },
  featuredInfo: {
    alignItems: 'flex-end',
    flex: 0.92,
    minWidth: 0,
  },
  primaryBadge: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderRadius: 11,
    flexDirection: 'row-reverse',
    gap: 5,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  primaryBadgeText: {
    color: colors.white,
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  poolName: {
    color: colors.text,
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 26,
    marginBottom: 6,
    ...rtl.text,
  },
  infoLine: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
    marginTop: 3,
  },
  infoText: {
    color: colors.textSoft,
    flexShrink: 1,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '800',
    ...rtl.text,
  },
  statusPill: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillCompact: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  metricRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 10,
  },
  metricPill: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    minHeight: 76,
    paddingHorizontal: 6,
    paddingVertical: 8,
    ...shadows.soft,
  },
  metricHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 4,
  },
  metricLabel: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 11,
    fontWeight: '800',
    ...rtl.textCenter,
  },
  metricValue: {
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
    marginTop: 3,
    ...rtl.textCenter,
  },
  metricStatus: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 0,
    ...rtl.textCenter,
  },
  featuredActions: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  scanButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: 'row-reverse',
    gap: 7,
    minHeight: 44,
    minWidth: 138,
    paddingHorizontal: 16,
    ...shadows.button,
  },
  scanButtonText: {
    color: colors.white,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  compactCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    minHeight: 126,
    padding: 12,
    ...shadows.card,
  },
  compactImage: {
    borderRadius: 15,
    height: 96,
    overflow: 'hidden',
    width: '48%',
  },
  compactImageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  compactDots: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,56,68,0.22)',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    top: 7,
    width: 28,
  },
  compactInfo: {
    alignItems: 'flex-end',
    flex: 1,
  },
  compactName: {
    color: colors.text,
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
    ...rtl.text,
  },
  addPoolButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 22,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexDirection: 'row-reverse',
    gap: 12,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 58,
  },
  addCircle: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.round,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  addText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 18,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  addHint: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    ...rtl.textCenter,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 9,
    marginTop: 18,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  emptyText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    ...rtl.textCenter,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
