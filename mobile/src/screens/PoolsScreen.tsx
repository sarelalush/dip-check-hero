import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { PoolCard } from '../components/PoolCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, rtl, typography } from '../theme';
import { mockPools } from '../data/mockAppData';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Pools'>;

export function PoolsScreen({ navigation }: Props) {
  return (
    <AppShell activeTab="pools" navigation={navigation}>
      <View style={styles.header}>
        <Text style={styles.title}>הבריכות שלי</Text>
      </View>

      <View style={styles.addWrap}>
        <PrimaryButton label="הוספת בריכה" icon="plus" />
      </View>

      <View style={styles.list}>
        {mockPools.map((pool, index) => (
          <PoolCard
            key={pool.id}
            name={pool.name}
            volume={pool.volume}
            status={pool.status}
            tone={pool.tone}
            variant={index === 0 ? 'villa' : 'city'}
            onPress={() => navigation.navigate('PoolDetails', { poolId: pool.id })}
          />
        ))}
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
});
