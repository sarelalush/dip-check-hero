import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultRow } from '../components/ResultRow';
import { LineIcon } from '../components/LineIcon';
import { colors, rtl, typography } from '../theme';
import { mockPools, resultRows } from '../data/mockAppData';
import { useResultsHistory } from '../state/ResultsHistoryContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

export function ResultsScreen({ navigation, route }: Props) {
  const { saveMockResult } = useResultsHistory();
  const pool = route.params?.poolId ? mockPools.find((item) => item.id === route.params?.poolId) : undefined;
  const hasImage = Boolean(route.params?.imageUri);

  function handleSave() {
    saveMockResult({ poolId: route.params?.poolId });
    navigation.navigate('History');
  }

  return (
    <AppShell activeTab="scan" navigation={navigation}>
      <View style={styles.header}>
        <Text style={styles.title}>תוצאות הבדיקה</Text>
        <Text style={styles.poolName}>{pool?.name ?? mockPools[0].name}</Text>
        <Text style={styles.subtitle}>היום, 18 במאי 2024 09:41</Text>
      </View>

      <View style={styles.resultsList}>
        {hasImage ? (
          <View style={styles.imageReceived}>
            <View style={styles.imageReceivedIcon}>
              <LineIcon name="image" color={colors.primaryDark} size={15} />
            </View>
            <Text style={styles.imageReceivedText}>תמונת הסטיק התקבלה - מוצגות תוצאות mock</Text>
          </View>
        ) : null}

        {resultRows.map((row) => (
          <ResultRow
            key={row.label}
            label={row.label}
            progress={row.progress}
            range={row.range}
            status={row.status}
            tone={row.tone}
            value={row.value}
          />
        ))}
      </View>

      <Card compact style={styles.recommendation}>
        <View style={styles.recommendationIcon}>
          <LineIcon name="drop" color={colors.primaryDark} size={15} />
        </View>
        <View style={styles.recommendationCopy}>
          <Text style={styles.recommendationTitle}>המלצה</Text>
          <Text style={styles.recommendationText}>
            הוסף 120 מ״ל כלור והוסף 80 גרם אלקליניות+
          </Text>
        </View>
      </Card>

      <View style={styles.saveButton}>
        <PrimaryButton label="סיום ושמירה" icon="history" onPress={handleSave} />
      </View>
    </AppShell>
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
    fontSize: 21,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  poolName: {
    marginTop: 10,
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    marginTop: 7,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 11,
    fontWeight: '800',
    ...rtl.textCenter,
  },
  resultsList: {
    marginTop: 18,
    gap: 11,
  },
  imageReceived: {
    minHeight: 42,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  imageReceivedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageReceivedText: {
    flex: 1,
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.text,
  },
  recommendation: {
    marginTop: 12,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
  },
  recommendationIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationCopy: {
    flex: 1,
  },
  recommendationTitle: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.text,
  },
  recommendationText: {
    marginTop: 5,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 19,
    ...rtl.text,
  },
  saveButton: {
    marginTop: 16,
  },
});
