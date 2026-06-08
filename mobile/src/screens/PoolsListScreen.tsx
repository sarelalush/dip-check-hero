import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabBar } from '../components/BottomTabBar';
import { colors, radius, rtl, shadows, typography } from '../theme';
import { usePools } from '../state/PoolsContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PoolsList'>;

const STOCK_COVER = 'https://images.unsplash.com/photo-1572331165267-854da2b10ccc?auto=format&fit=crop&w=800&q=70';

export function PoolsListScreen({ navigation }: Props) {
  const { pools } = usePools();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>הבריכות שלי</Text>

        <Pressable
          onPress={() => navigation.navigate('AddPool')}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.addPlus}>+</Text>
          <Text style={styles.addLabel}>הוספת בריכה</Text>
        </Pressable>

        <View style={styles.list}>
          {pools.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>עדיין אין בריכות. הוסיפו את הבריכה הראשונה כדי להתחיל.</Text>
            </View>
          ) : (
            pools.map((pool) => (
              <Pressable
                key={pool.id}
                onPress={() => navigation.navigate('PoolDetails', { poolId: pool.id })}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
              >
                <Image source={{ uri: STOCK_COVER }} style={styles.cover} />
                <View style={styles.cardBody}>
                  <View style={styles.cardHead}>
                    <Text style={styles.menuDots}>⋯</Text>
                    <Text style={styles.poolName}>{pool.name}</Text>
                  </View>
                  <Text style={styles.poolMeta}>💧 נפח: {pool.volumeLiters.toLocaleString('he-IL')} ליטר</Text>
                  <Text style={styles.poolStatus}>✓ המים מאוזנים</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <BottomTabBar active="pools" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 36, paddingBottom: 140 },
  title: { textAlign: 'center', fontSize: 28, fontWeight: '900', color: colors.text, fontFamily: typography.fontFamily },
  addBtn: { marginTop: 22, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.round, paddingVertical: 16, ...shadows.button },
  addPlus: { color: colors.white, fontSize: 22, fontWeight: '900' },
  addLabel: { color: colors.white, fontSize: 16, fontWeight: '900', fontFamily: typography.fontFamily },
  list: { marginTop: 22, gap: 16 },
  empty: { backgroundColor: colors.card, borderRadius: 24, padding: 28, ...shadows.card },
  emptyText: { color: colors.muted, textAlign: 'center', fontWeight: '700', fontSize: 14, fontFamily: typography.fontFamily },
  card: { backgroundColor: colors.card, borderRadius: 24, overflow: 'hidden', ...shadows.card },
  cover: { width: '100%', height: 150, backgroundColor: colors.subtle },
  cardBody: { padding: 14 },
  cardHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  menuDots: { color: colors.muted, fontSize: 20, fontWeight: '900' },
  poolName: { color: colors.text, fontSize: 18, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily, flex: 1 },
  poolMeta: { marginTop: 6, color: colors.muted, fontSize: 12, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
  poolStatus: { marginTop: 4, color: '#059669', fontSize: 12, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
});
