import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { PoolCard } from '../components/PoolCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, rtl, typography } from '../theme';
import { usePools } from '../state/PoolsContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Pools'>;

export function PoolsScreen({ navigation }: Props) {
  const { pools } = usePools();

  return (
    <AppShell activeTab="pools" navigation={navigation}>
      <View style={styles.header}>
        <Text style={styles.title}>הבריכות שלי</Text>
      </View>

      <View style={styles.addWrap}>
        <PrimaryButton label="הוספת בריכה" icon="plus" onPress={() => navigation.navigate('AddPool')} />
      </View>

      <View style={styles.list}>
        {pools.length > 0 ? (
          pools.map((pool, index) => (
            <PoolCard
              key={pool.id}
              name={pool.name}
              volume={`${pool.volumeLiters.toLocaleString('he-IL')} ליטר`}
              status="המים מאוזנים"
              tone="success"
              variant={index % 2 === 0 ? 'villa' : 'city'}
              imageUri={pool.imageUri}
              imageUrl={pool.imageUrl}
              onPress={() => navigation.navigate('PoolDetails', { poolId: pool.id })}
            />
          ))
        ) : (
          <Card compact style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>עדיין אין בריכות</Text>
            <Text style={styles.emptyText}>הוסיפו בריכה כדי להתחיל סריקה ולשמור היסטוריית בדיקות אמיתית.</Text>
            <View style={styles.emptyAction}>
              <PrimaryButton label="הוספת בריכה ראשונה" icon="plus" onPress={() => navigation.navigate('AddPool')} />
            </View>
          </Card>
        )}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 18,
    marginBottom: 16,
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 21,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  addWrap: {
    width: '62%',
    alignSelf: 'center',
  },
  list: {
    marginTop: 16,
    gap: 16,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  emptyText: {
    marginTop: 5,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
    ...rtl.textCenter,
  },
  emptyAction: {
    marginTop: 8,
    width: '100%',
  },
});
