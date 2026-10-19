import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { StripAnalysisResult } from '../domain/scanResults';
import type { Pool } from '../domain/pool';
import { MEASUREMENT_SAFETY_NOTE, SHORT_TREATMENT_NOTE } from '../domain/dosage';
import { nextAction, resultStatus } from '../domain/resultPresentation';
import { MEASUREMENT_COPY } from '../domain/measurementPresentation';
import { useTreatments } from '../state/TreatmentContext';
import {
  cancelPoolReminderNotification,
  scheduleRetestNotification,
} from '../services/notificationService';
import { colors, rtl, typography } from '../theme';
import { Card } from './Card';
import { PrimaryButton } from './PrimaryButton';
import { DisclosureSection } from './DisclosureSection';
import { LineIcon } from './LineIcon';
import { TreatmentSteps } from './TreatmentSteps';
import { getChlorineReview } from '../domain/readingComparison';
import { buildChlorineActionPlan } from '../domain/metricGuidance';

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
  const { getTreatment, saveTreatment, hydrated, error: storageError } = useTreatments();
  const treatment = getTreatment(testId);
  const chlorineReview = getChlorineReview(result.parameters);
  const chlorinePlan = chlorineReview ? buildChlorineActionPlan(chlorineReview) : undefined;
  const treatmentBlocked = Boolean(chlorineReview) || result.dosage?.treatmentBlocked !== false;
  const primary = result.dosage?.primaryRecommendation;
  const showChlorinePlan = Boolean(chlorinePlan && !primary);
  const displayStatus = resultStatus(result);
  const inRange = displayStatus.tone === 'success';
  const actionTitle = showChlorinePlan
    ? chlorineReview?.reason === 'inconsistent' ? 'בודקים שוב את הכלור' : 'מטפלים בפער בין סוגי הכלור'
    : primary?.actionUncertain ? `בודקים שוב: ${MEASUREMENT_COPY[primary.paramKey].label}`
    : primary ? `מתחילים ב${MEASUREMENT_COPY[primary.paramKey].label}`
    : inRange ? 'ממשיכים במעקב רגיל'
    : displayStatus.label === 'כלור כולל מחוץ לטווח ההשוואה' ? 'קוראים את שני סוגי הכלור יחד'
    : 'משלימים את הבדיקה';
  const followUpSteps =
    primary?.actionHe
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(1) ?? [];
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [hours, setHours] = useState(String(pool?.retestHours ?? 6));
  const [message, setMessage] = useState('');
  const scheduled = Boolean(treatment?.notificationId);
  const formatDate = (at: number) =>
    new Date(at).toLocaleString('he-IL', {
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  async function markDone() {
    if (treatmentBlocked || !pool || !primary || lock.current || treatment || !allowRecord) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await saveTreatment({
        testId,
        poolId: pool.id,
        actionText: primary.actionHe.split('\n')[0],
        performedAt: Date.now(),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'התיעוד לא נשמר. נסה שוב.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function remind() {
    const delayHours = Number(hours);
    if (!treatment || !pool || lock.current || scheduled) return;
    if (!/^\d{1,3}$/.test(hours) || delayHours < 1 || delayHours > 168) {
      setMessage('הזן מספר שעות בין 1 ל־168 לפי הוראות הטיפול.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage('');
    let newNotificationId: string | undefined;
    try {
      const retestAt = treatment.performedAt + delayHours * 60 * 60 * 1000;
      if (retestAt <= Date.now()) {
        setMessage('הזמן הזה כבר עבר מאז הטיפול. אפשר לבצע בדיקה חדשה או לבחור זמן מאוחר יותר.');
        return;
      }
      const response = await scheduleRetestNotification({
        poolId: pool.id,
        poolName: pool.name,
        retestAt,
      });
      if (response.error || !response.notificationId) {
        setMessage(response.error ?? 'לא ניתן להפעיל תזכורת.');
        return;
      }
      newNotificationId = response.notificationId;
      await saveTreatment({ ...treatment, retestAt, notificationId: response.notificationId });
    } catch {
      if (newNotificationId) await cancelPoolReminderNotification(newNotificationId);
      setMessage('לא הצלחנו לשמור את התזכורת. תיעוד הפעולה נשמר.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <Card style={[styles.card, showChlorinePlan && styles.reviewCard]}>
      {treatmentBlocked ? (
        <>
          <View style={styles.actionHeader}>
            <View style={styles.actionIcon}><LineIcon name={inRange ? 'check' : 'results'} color={colors.primaryDeep} size={20} /></View>
            <View style={styles.actionHeading}>
              <Text style={styles.kicker}>מה עושים עכשיו?</Text>
              <Text style={styles.actionTitle}>{actionTitle}</Text>
            </View>
          </View>
          {isHistorical ? <Text style={styles.historicalNote}>זו בדיקה קודמת. בצע בדיקה עדכנית לפני טיפול.</Text> : null}
          {showChlorinePlan ? <>
            {chlorinePlan!.treatmentNote ? <View style={styles.beforeTreatment}>
              <Text style={styles.beforeTitle}>לפני שמתחילים</Text>
              <Text style={styles.note}>{chlorinePlan!.treatmentNote}</Text>
            </View> : null}
            <TreatmentSteps steps={chlorinePlan!.steps} />
          </> : primary?.guidance ? <>
            <TreatmentSteps steps={primary.actionHe.split('\n').filter(Boolean)} />
          </> : <Text style={styles.followUp}>{nextAction(result)}</Text>}
          {primary ? <View style={styles.nextStage}>
            <LineIcon name="history" color={colors.primaryDeep} size={15} />
            <Text style={styles.nextStageText}>מטפלים עכשיו במדד אחד. בבדיקה הבאה נבחר מחדש את הטיפול לפי כל הערכים, גם אם השתנו.</Text>
          </View> : null}
          {primary ? <Text style={styles.note}>אמת חריגה לפני הוספת חומר. פעל לפי התווית ואל תערבב חומרים.</Text> : null}
          <DisclosureSection title="הסבר ומידע חשוב">
            {showChlorinePlan ? <Text style={styles.note}>{chlorinePlan!.explanation}</Text> : null}
            {primary?.guidance ? <Text style={styles.note}>{primary.guidance.meaning}</Text> : null}
            <Text style={styles.note}>{MEASUREMENT_SAFETY_NOTE}</Text>
            {result.evidence?.diagnosticWarnings?.length ? <Text style={styles.note}>
              הצילום והתאורה יכולים להשפיע על הקריאה. ערכים חלופיים מופיעים ליד המדד כשקיימים.
            </Text> : null}
            <Text style={styles.note}>{SHORT_TREATMENT_NOTE}</Text>
          </DisclosureSection>
          {chlorineReview || !primary ? (
            <Pressable accessibilityRole="button" style={styles.linkButton} onPress={onNewScan}>
              <LineIcon name="scan" color={colors.primaryDeep} size={17} />
              <Text style={styles.link}>{isHistorical ? 'בדיקה עדכנית' : 'סריקת סטיק נוספת'}</Text>
            </Pressable>
          ) : <PrimaryButton label={isHistorical ? 'בדיקה עדכנית' : 'בדיקה חוזרת'} icon="scan" onPress={onNewScan} />}
        </>
      ) : <>
      <Text style={styles.kicker}>{treatment ? 'הפעולה תועדה' : 'מה עושים עכשיו'}</Text>
      <Text style={styles.action}>{treatment?.actionText ?? nextAction(result)}</Text>
      {followUpSteps.length ? (
        <View style={styles.steps}>
          {followUpSteps.map((step, index) => (
            <View key={`${index}-${step}`} style={styles.stepRow}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>
                {step.replace(/\d+(?:[.,]\d+)?[–-]\d+(?:[.,]\d+)?/g, '\u2066$&\u2069')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {primary?.product && primary.exactAmountAvailable && !treatment ? (
        <DisclosureSection title="פרטי המינון">
          <Text style={styles.amount}>
            כמות מחושבת: {primary.product.amount.toLocaleString('he-IL')} {primary.product.unit} ·{' '}
            {primary.product.labelHe}
          </Text>
        </DisclosureSection>
      ) : null}
      {result.dosage?.safetyNote ? (
        <View style={styles.safety}>
          <LineIcon name="shield" color={colors.primaryDeep} size={16} />
          <Text style={[styles.note, styles.safetyText]}>{result.dosage.safetyNote}</Text>
        </View>
      ) : null}
      {result.dosage?.volumeMissing ? (
        <Pressable accessibilityRole="button" onPress={onEditPool} style={styles.linkButton}>
          <Text style={styles.link}>השלם את נפח הבריכה לקבלת מינון</Text>
        </Pressable>
      ) : null}
      {primary && !result.dosage?.volumeMissing && !treatment && allowRecord && pool ? (
        <>
          <Text style={styles.note}>סמן רק לאחר ביצוע הפעולה.</Text>
          <PrimaryButton
            disabled={!hydrated || busy}
            busy={busy}
            label="ביצעתי את הפעולה"
            icon="check"
            onPress={markDone}
          />
        </>
      ) : null}
      {primary && !allowRecord && !treatment ? (
        <Text style={styles.note}>
          זו בדיקה קודמת. בצע בדיקה חדשה לפני טיפול לפי מצב המים כיום.
        </Text>
      ) : null}
      {treatment ? (
        <>
          <Text style={styles.note}>
            תועד ב־{formatDate(treatment.performedAt)}. התיעוד נשמר במכשיר הזה.
          </Text>
          {scheduled && treatment.retestAt ? (
            <Text style={styles.amount}>
              {treatment.retestAt <= Date.now()
                ? 'הגיע הזמן לבדיקה חוזרת'
                : `תזכורת לבדיקה: ${formatDate(treatment.retestAt)}`}
            </Text>
          ) : (
            <>
              <Text style={styles.note}>
                מתי לבדוק שוב? הזמן נספר מרגע תיעוד הפעולה. התאם להוראות יצרן החומר ולמשך הסחרור
                הנדרש.
              </Text>
              <View style={styles.hoursRow}>
                <Text style={styles.label}>שעות אחרי הטיפול</Text>
                <TextInput
                  accessibilityLabel="שעות לבדיקה חוזרת לאחר הטיפול"
                  keyboardType="number-pad"
                  value={hours}
                  maxLength={3}
                  onChangeText={(text) => setHours(text.replace(/\D/g, ''))}
                  style={styles.input}
                />
              </View>
              <PrimaryButton
                busy={busy}
                disabled={busy}
                label="הפעל תזכורת לבדיקה חוזרת"
                icon="bell"
                onPress={remind}
              />
            </>
          )}
          <Pressable accessibilityRole="button" onPress={onNewScan} style={styles.linkButton}>
            <Text style={styles.link}>בצע בדיקה חדשה</Text>
          </Pressable>
        </>
      ) : null}
      {storageError ? <Text style={styles.note}>{storageError}</Text> : null}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          {message}
        </Text>
      ) : null}
      </>}
    </Card>
  );
}
const styles = StyleSheet.create({
  reviewCard: { borderColor: '#E8D4A5' },
  card: { marginTop: 14, gap: 14, padding: 16, borderWidth: 1, borderColor: colors.borderStrong },
  actionHeader: { ...rtl.row, alignItems: 'center', gap: 10 },
  actionIcon: { width: 40, height: 40, backgroundColor: colors.primarySoft, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center' },
  actionHeading: { flex: 1, gap: 3 },
  actionTitle: { color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 19, lineHeight: 28, ...rtl.text },
  beforeTreatment: { backgroundColor: colors.warningSoft, borderRadius: 12, padding: 12, gap: 4 },
  beforeTitle: { color: '#8A5600', fontFamily: typography.fontFamilySemiBold, fontSize: 12, ...rtl.text },
  historicalNote: { color: '#8A5600', fontFamily: typography.fontFamilyMedium, fontSize: 13, lineHeight: 21, ...rtl.text },
  nextStage: { ...rtl.row, alignItems: 'flex-start', gap: 6, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 12 },
  nextStageText: { flex: 1, color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, lineHeight: 20, ...rtl.text },
  steps: { gap: 8 },
  stepRow: { ...rtl.row, alignItems: 'flex-start', gap: 9 },
  stepDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 9,
    backgroundColor: colors.primary,
  },
  stepText: {
    flex: 1,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    lineHeight: 22,
    ...rtl.text,
  },
  safety: {
    ...rtl.row,
    alignItems: 'flex-start',
    gap: 7,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  safetyText: { flex: 1 },
  kicker: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilyMedium,
    fontSize: 12,
    ...rtl.text,
  },
  action: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 20,
    lineHeight: 30,
    ...rtl.text,
  },
  followUp: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    lineHeight: 22,
    ...rtl.text,
  },
  amount: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    lineHeight: 23,
    ...rtl.text,
  },
  note: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 20,
    ...rtl.text,
  },
  hoursRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  label: { flex: 1, color: colors.text, fontFamily: typography.fontFamilyRegular, ...rtl.text },
  input: {
    width: 80,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 12,
    borderRadius: 12,
    color: colors.text,
    textAlign: 'center',
  },
  linkButton: { ...rtl.row, minHeight: 46, justifyContent: 'center', alignItems: 'center', gap: 6,
    borderRadius: 12, backgroundColor: colors.backgroundSoft, paddingHorizontal: 10 },
  link: { color: colors.primaryDeep, fontFamily: typography.fontFamilySemiBold, ...rtl.text },
});
