import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { PoolCard } from '../components/PoolCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { getBrand } from '../config/stripBrands';
import { usePools } from '../state/PoolsContext';
import { useScanSession } from '../state/ScanSessionContext';
import { colors, rtl, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectPool'>;

function formatVolume(liters: number) {
  if (!liters) return 'נפח לא הוגדר';
  return `נפח: ${liters.toLocaleString('he-IL')} ליטר`;
}

export function SelectPoolScreen({ navigation }: Props) {
  const { pools } = usePools();
  const { startScanSession } = useScanSession();

  function selectPool(poolId: string) {
    const pool = pools.find((item) => item.id === poolId);
    if (!pool) return;
    const brand = pool.stripBrandId ? getBrand(pool.stripBrandId) : undefined;
    const canSkipStripSelection = Boolean(brand?.supported);

    startScanSession({ brandId: canSkipStripSelection ? brand?.id : pool.stripBrandId, poolId: pool.id });
    if (canSkipStripSelection) {
      navigation.replace('Scan', { brandId: brand?.id, poolId: pool.id });
      return;
    }

    navigation.replace('SelectStrip', { poolId: pool.id });
  }

  return (
    <AppShell activeTab="scan" navigation={navigation}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <LineIcon name="pools" color={colors.primaryDark} size={24} />
        </View>
        <Text style={styles.title}>בחר בריכה לבדיקה</Text>
        <Text style={styles.subtitle}>כדי שההמלצה תהיה מדויקת, צריך לדעת עבור איזו בריכה מתבצעת הסריקה.</Text>
      </View>

      {pools.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <LineIcon name="plus" color={colors.primaryDark} size={26} />
          </View>
          <Text style={styles.emptyTitle}>עדיין אין בריכה</Text>
          <Text style={styles.emptyText}>הוסף בריכה ראשונה, ואז תוכל לסרוק סטיק ולקבל המלצה לפי נפח וסוג הבריכה.</Text>
          <PrimaryButton label="הוסף בריכה" icon="plus" onPress={() => navigation.navigate('AddPool')} />
        </Card>
      ) : (
        <View style={styles.list}>
          {pools.map((pool, index) => (
            <PoolCard
              key={pool.id}
              imageUri={pool.imageUri}
              imageUrl={pool.imageUrl}
              name={pool.name}
              status="בחר לסריקה"
              tone="neutral"
              variant={index % 2 === 0 ? 'villa' : 'city'}
              volume={formatVolume(pool.volumeLiters)}
              onPress={() => selectPool(pool.id)}
            />
          ))}
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: 18,
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    marginBottom: 10,
    width: 52,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 5,
    paddingHorizontal: 18,
    ...rtl.textCenter,
  },
  list: {
    gap: 14,
    marginTop: 22,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 12,
    marginTop: 26,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 19,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  emptyText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    ...rtl.textCenter,
  },
});
