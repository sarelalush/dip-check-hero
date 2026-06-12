import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader } from '../components/AppHeader';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { MetricCard } from '../components/MetricCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { PoolPhoto } from '../components/WaterVisuals';
import { colors, rtl, typography } from '../theme';
import { homeMetrics } from '../data/mockAppData';
import { usePools } from '../state/PoolsContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { pools } = usePools();
  const hasPools = pools.length > 0;

  if (!hasPools) {
    return (
      <AppShell activeTab="home" navigation={navigation}>
        <AppHeader />

        <View style={styles.greeting}>
          <Text style={styles.hello}>ברוכים הבאים ל־AquaSense</Text>
          <Text style={styles.subtitle}>כדי להתחיל, הוסף את הבריכה הראשונה שלך</Text>
        </View>

        <View style={styles.hero}>
          <PoolPhoto variant="home" />
        </View>

        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <LineIcon name="pools" color={colors.primaryDark} size={28} />
          </View>
          <Text style={styles.statusTitle}>הבריכה שלך מתחילה כאן</Text>
          <Text style={styles.emptyText}>לאחר מכן תוכל לצלם סטיק ולקבל המלצה מותאמת לפי נפח וסוג הבריכה.</Text>
        </Card>

        <View style={styles.ctaWrap}>
          <PrimaryButton label="הוסף בריכה" icon="plus" onPress={() => navigation.navigate('AddPool')} />
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="home" navigation={navigation}>
      <AppHeader />

      <View style={styles.greeting}>
        <Text style={styles.hello}>שלום דן!</Text>
        <Text style={styles.subtitle}>כיף לראות אותך שוב</Text>
      </View>

      <View style={styles.hero}>
        <PoolPhoto variant="home" />
      </View>

      <Card style={styles.statusCard}>
        <Text style={styles.cardKicker}>מצב המים</Text>
        <View style={styles.checkCircle}>
          <LineIcon name="check" color={colors.success} size={32} />
        </View>
        <Text style={styles.statusTitle}>רוב הערכים תקינים</Text>
        <Text style={styles.statusSubtitle}>המים שלך נקיים ובריאים</Text>

        <View style={styles.metrics}>
          {homeMetrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              status={metric.status}
              tone={metric.tone}
              value={metric.value}
            />
          ))}
        </View>
      </Card>

      <View style={styles.ctaWrap}>
        <PrimaryButton label="התחל סריקה" icon="scan" onPress={() => navigation.navigate('SelectStrip')} />
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  greeting: {
    marginTop: 10,
    alignItems: 'center',
  },
  hello: {
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
    fontSize: 14,
    fontWeight: '800',
    ...rtl.textCenter,
  },
  hero: {
    marginHorizontal: -20,
    marginTop: 16,
    height: 230,
    borderRadius: 0,
    backgroundColor: colors.water,
    overflow: 'hidden',
  },
  statusCard: {
    width: '79%',
    alignSelf: 'center',
    marginTop: -132,
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
    borderRadius: 20,
  },
  emptyCard: {
    width: '84%',
    alignSelf: 'center',
    marginTop: -112,
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    borderRadius: 20,
  },
  emptyIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
    ...rtl.textCenter,
  },
  cardKicker: {
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#CFF6D6',
    borderWidth: 1,
    borderColor: '#9EE8AD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 19,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  statusSubtitle: {
    marginTop: -7,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '800',
    ...rtl.textCenter,
  },
  metrics: {
    width: '100%',
    flexDirection: 'row-reverse',
    gap: 8,
  },
  ctaWrap: {
    marginTop: 16,
  },
});
