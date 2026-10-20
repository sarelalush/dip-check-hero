import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StripAnalysisResult } from '../domain/scanResults';
import type { Pool } from '../domain/pool';
import { nextAction, resultStatus } from '../domain/resultPresentation';
import { MEASUREMENT_COPY } from '../domain/measurementPresentation';
import { buildScanChlorineActionPlan } from '../domain/metricGuidance';
import { getSavedScanTreatmentPlan } from '../domain/savedTreatmentPlan';
import { colors, rtl, typography } from '../theme';
import { Card } from './Card';
import { PrimaryButton } from './PrimaryButton';
import { LineIcon } from './LineIcon';
import { StagedTreatmentSteps } from './StagedTreatmentSteps';
import { TreatmentSteps } from './TreatmentSteps';
import { DisclosureSection } from './DisclosureSection';
import { useTreatments } from '../state/TreatmentContext';
import { useResultsHistory } from '../state/ResultsHistoryContext';

export function NextActionCard({
  result,
  testId = result.id,
  pool,
  allowRecord = true,
  isHistorical = false,
  onNewScan,
  onEditPool,
}: {
  result: StripAnalysisResult;
  testId?: string;
  pool?: Pool;
  allowRecord?: boolean;
  isHistorical?: boolean;
  onNewScan: () => void;
  onEditPool: () => void;
}) {
  const primary = result.dosage?.primaryRecommendation;
  const { getHistoryRecord } = useResultsHistory();
  const savedPlan = getSavedScanTreatmentPlan(getHistoryRecord(testId)?.analysisResult) ?? getSavedScanTreatmentPlan(result);
  const { getLatestPoolTreatment } = useTreatments();
  const latest = getLatestPoolTreatment(pool ? [pool.id, ...(pool.cloudId ? [pool.cloudId] : [])] : []);
  const needsDpdFollowUp = latest?.requiresDpdFollowUp === true;
  const needsNewResult = Boolean(latest?.dpdFollowUp && result.analyzedAt <= latest.dpdFollowUp.measuredAt);
  const displayStatus = resultStatus(result);
  const hasInstructions = Boolean(savedPlan?.product || primary?.guidance);
  const chlorinePlan = hasInstructions ? undefined : buildScanChlorineActionPlan(result);
  const hasActionSteps = hasInstructions || Boolean(chlorinePlan);
  const inRange = displayStatus.tone === 'success' && !chlorinePlan;
  const hasAmbiguousReading = displayStatus.label === 'קריאה בין טווחים';
  const actionTitle = !isHistorical && needsDpdFollowUp ? 'נדרשת בדיקת המשך אחרי השוק'
    : !isHistorical && needsNewResult ? 'ממשיכים מבדיקה חדשה'
    : isHistorical && savedPlan?.product ? `הטיפול לבדיקה: ${savedPlan.labelHe}`
    : chlorinePlan ? chlorinePlan.title
    : hasAmbiguousReading ? 'בדיקה חוזרת לפני טיפול'
    : primary?.actionUncertain ? `בודקים שוב: ${MEASUREMENT_COPY[primary.paramKey].label}`
    : primary ? `מתחילים ב${MEASUREMENT_COPY[primary.paramKey].label}`
    : displayStatus.label === 'כלור כולל מחוץ לטווח ההשוואה' ? 'בודקים את שני סוגי הכלור'
    : 'משלימים את הבדיקה';

  if (inRange && !hasInstructions && (isHistorical || (!needsDpdFollowUp && !needsNewResult))) {
    return <Card style={[styles.card, styles.balancedCard]}>
      <View style={styles.balancedIcon}><LineIcon name="check" size={25} color="#238568" /></View>
      <Text style={styles.balancedTitle}>{isHistorical ? 'המדדים היו בטווח בבדיקה' : 'ממשיכים במעקב רגיל'}</Text>
      <Text style={styles.balancedText}>{isHistorical
        ? 'זו בדיקה קודמת. בצע בדיקה עדכנית לפני טיפול.'
        : 'לפי המדדים שנבדקו, אין צורך להוסיף חומרים.'}</Text>
      <PrimaryButton variant="refined" label={isHistorical ? 'בדיקה עדכנית' : 'בדיקה חדשה'} icon="scan" onPress={onNewScan} />
    </Card>;
  }

  return (
    <Card style={styles.card}>
      <View style={styles.actionHeader}>
        <View style={styles.actionIcon}><LineIcon name="flash" color={colors.primaryDeep} size={17} /></View>
        <View style={styles.actionHeading}>
          <Text style={styles.kicker}>{isHistorical ? savedPlan?.product ? 'הנחיות מההיסטוריה' : 'לפי תוצאות הבדיקה הקודמת' : 'מה עושים עכשיו?'}</Text>
          <Text style={styles.actionTitle}>{actionTitle}</Text>
        </View>
      </View>
      {!isHistorical && needsDpdFollowUp ? <Text style={styles.followUp}>תועד טיפול שוק. לפני מנה נוספת נדרשת בדיקת המשך מתאימה; אין לחשב אותה מצילום בלבד. קבל הנחיית המשך מקצועית.</Text>
      : !isHistorical && needsNewResult && !savedPlan?.product ? <Text style={styles.followUp}>בצע סריקה חדשה כדי לבחור את הטיפול הבא לפי המים כעת.</Text>
      : hasInstructions ? (
        <StagedTreatmentSteps result={result} primary={primary} pool={pool} testId={testId}
          isHistorical={isHistorical} allowRecord={allowRecord} onEditPool={onEditPool} />
      ) : chlorinePlan ? <>
        {isHistorical ? <Text style={styles.note}>הנחיות לפי בדיקה קודמת. לפני הוספת חומר נדרשת בדיקה עדכנית.</Text> : null}
        <TreatmentSteps steps={chlorinePlan.steps} compact />
        <DisclosureSection title="למה זה הטיפול?" variant="quiet">
          <Text style={styles.followUp}>{chlorinePlan.explanation}</Text>
          {chlorinePlan.treatmentNote ? <Text style={styles.note}>{chlorinePlan.treatmentNote}</Text> : null}
        </DisclosureSection>
      </> : <Text style={styles.followUp}>{hasAmbiguousReading
        ? 'לא התקבלה התאמה חד־משמעית למקרא. בצע סריקה חדשה לפני חישוב כמות להוספה.' : nextAction(result)}</Text>}
      {hasActionSteps ? (
        <Pressable accessibilityRole="button" style={styles.linkButton} onPress={onNewScan}>
          <LineIcon name="scan" color={colors.primaryDeep} size={17} />
          <Text style={styles.link}>{isHistorical ? 'בדיקה עדכנית' : 'בדיקה חוזרת'}</Text>
        </Pressable>
      ) : <PrimaryButton variant="refined" label={isHistorical ? 'בדיקה עדכנית' : 'בדיקה חוזרת'} icon="scan" onPress={onNewScan} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  balancedCard: { paddingVertical: 22, gap: 12 },
  balancedIcon: { alignSelf: 'center', width: 42, height: 42, borderRadius: 21, backgroundColor: colors.successSoft,
    alignItems: 'center', justifyContent: 'center' },
  balancedTitle: { color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 18, lineHeight: 27, ...rtl.textCenter },
  balancedText: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 13, lineHeight: 22, ...rtl.textCenter },
  card: { marginTop: 16, gap: 14, padding: 19, borderRadius: 28, borderWidth: 1, borderColor: '#E4EEF3',
    shadowOpacity: 0.06, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  actionHeader: { ...rtl.row, alignItems: 'center', gap: 9 },
  actionIcon: { width: 38, height: 38, backgroundColor: '#E5F4F8', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center' },
  actionHeading: { flex: 1, gap: 2 },
  actionTitle: { color: '#173B52', fontFamily: typography.fontFamilyBold, fontSize: 19, lineHeight: 28, ...rtl.text },
  kicker: { color: colors.primaryDeep, fontFamily: typography.fontFamilyMedium, fontSize: 12, ...rtl.text },
  followUp: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 14, lineHeight: 23, ...rtl.text },
  note: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, lineHeight: 20, ...rtl.text },
  linkButton: { ...rtl.row, minHeight: 44, justifyContent: 'center', alignItems: 'center', gap: 6,
    borderRadius: 13, backgroundColor: '#F6FAFC', paddingHorizontal: 10 },
  link: { color: colors.primaryDeep, fontFamily: typography.fontFamilySemiBold, fontSize: 14, ...rtl.text },
});
