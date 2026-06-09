import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PoolDetails'>;

export function PoolDetailsScreen({ navigation, route }: Props) {
  const { deletePool, getPool } = usePools();
  const pool = getPool(route.params.poolId);
  const poolName = pool?.name ?? 'בריכה ללא שם';
  const poolVolume = pool ? `${pool.volumeLiters.toLocaleString('he-IL')} ליטר` : 'לא הוגדר נפח';
  const brand = getBrand(pool?.stripBrandId);
  const typeLabel = pool ? getPoolTypeLabel(pool.type) : 'כלור רגיל';
  const shapeLabel = pool?.volumeEntryMethod === 'manual' ? 'נפח ידני' : getPoolShapeLabel(pool?.shape);
  const tabletsLabel = pool?.tabletsActive ? `${pool.tabletsCount ?? 1} טבליות · ${pool.tabletWeightGrams ?? 200} גרם` : 'אין טבליות פעילות';

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

  return (
    <AppShell activeTab="pools" navigation={navigation}>
      <View style={styles.header}>
        <Text style={styles.title}>{poolName}</Text>
        <Text style={styles.subtitle}>פרטי בריכה ובדיקה אחרונה</Text>
      </View>

      <View style={styles.photo}>
        <PoolPhoto variant="villa" />
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
        <Text style={styles.description}>בחר סטיק בדיקה כדי להתחיל סריקה עבור הבריכה הזו.</Text>
      </Card>

      <View style={styles.cta}>
        <PrimaryButton
          label="התחל סריקה"
          icon="scan"
          onPress={() => navigation.navigate('SelectStrip', { poolId: route.params.poolId })}
        />
      </View>

      {pool ? (
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Text style={styles.deleteText}>מחיקת בריכה</Text>
        </Pressable>
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
  deleteButton: {
    marginTop: 10,
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
});
