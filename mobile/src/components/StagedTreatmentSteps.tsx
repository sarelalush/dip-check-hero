import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DosageRecommendation } from '../domain/dosage';
import { TREATMENT_POLICY_VERSION } from '../domain/dosage';
import type { Pool } from '../domain/pool';
import type { StripAnalysisResult } from '../domain/scanResults';
import { buildStagedDose, STAGED_DOSING_LEGAL_VERSION, type StagedDosePlan } from '../domain/stagedDosage';
import { useLegalConsent } from '../state/LegalConsentContext';
import { useTreatments } from '../state/TreatmentContext';
import { useResultsHistory } from '../state/ResultsHistoryContext';
import { getSavedScanTreatmentPlan, treatmentPlanContentKey, type SavedTreatmentPlan } from '../domain/savedTreatmentPlan';
import { colors, rtl, typography } from '../theme';
import { DisclosureSection } from './DisclosureSection';
import { PrimaryButton } from './PrimaryButton';
import { TreatmentSteps } from './TreatmentSteps';

export function StagedTreatmentSteps({ result, primary, pool, testId, isHistorical, allowRecord, onEditPool }: {
  result: StripAnalysisResult;
  primary?: DosageRecommendation;
  pool?: Pool;
  testId: string;
  isHistorical: boolean;
  allowRecord: boolean;
  onEditPool: () => void;
}) {
  const { hydrated, error, getTreatment, getLatestPoolTreatment, saveTreatment } = useTreatments();
  const { getHistoryRecord, isHydrated: historyHydrated, saveAnalysisResult, syncError } = useResultsHistory();
  const { status: legalStatus, refresh: refreshConsent, checking: checkingConsent } = useLegalConsent();
  const consentCurrent = legalStatus?.serviceAccepted === true &&
    legalStatus.termsVersion === STAGED_DOSING_LEGAL_VERSION && legalStatus.releaseReady === true;
  const treatment = getTreatment(testId);
  const poolIds = pool ? [pool.id, ...(pool.cloudId ? [pool.cloudId] : [])] : [];
  const latest = getLatestPoolTreatment(poolIds);
  const [now, setNow] = useState(Date.now);
  const [waterTestIsCurrent, setWaterTestIsCurrent] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const [performedHere, setPerformedHere] = useState(false);
  const [performedPlan, setPerformedPlan] = useState<SavedTreatmentPlan>();
  const lock = useRef(false);
  const persistedPlanKey = useRef('');
  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const interval = setInterval(updateNow, 15000);
    const subscription = AppState.addEventListener('change', updateNow);
    return () => { clearInterval(interval); subscription.remove(); };
  }, []);
  useEffect(() => {
    setWaterTestIsCurrent(false);
  }, [pool?.id, pool?.volumeLiters, result.id, result.analyzedAt, primary?.paramKey, primary?.measured]);
  const candidatePlan = buildStagedDose(result, pool, {
    now, historical: isHistorical || !allowRecord, waterTestIsCurrent,
    latestTreatmentAt: latest?.performedAt, latestDoseRetestNotBefore: latest?.doseRetestNotBefore,
    latestTreatmentRequiresDpdFollowUp: latest?.requiresDpdFollowUp, latestDpdFollowUpAt: latest?.dpdFollowUp?.measuredAt,
  });
  const plan: StagedDosePlan = consentCurrent || !candidatePlan.product
    ? candidatePlan : { reason: 'כדי להציג כמות, יש לאשר את תנאי השימוש המעודכנים לחישוב מנות טיפול.' };
  const used = Boolean(treatment || performedHere);
  const editableCurrentResult = !isHistorical && allowRecord;
  // Eligibility controls the action button, never access to saved instructions.
  const showDose = Boolean(plan.product && hydrated && !error && !used && !busy);
  const waitingForLedger = Boolean(plan.product && !hydrated && !used);
  const defaultSteps = primary?.actionHe.split('\n').filter(Boolean) ?? [];
  const savedPlan = getSavedScanTreatmentPlan(getHistoryRecord(testId)?.analysisResult) ?? getSavedScanTreatmentPlan(result);
  const currentPlan: SavedTreatmentPlan | undefined = primary?.guidance ? {
    schemaVersion: 1, resultId: result.id, analyzedAt: result.analyzedAt, proposedAt: now,
    poolId: result.poolId, volumeLiters: pool?.volumeLiters && pool.volumeLiters > 0 ? pool.volumeLiters : undefined,
    paramKey: primary.paramKey, labelHe: primary.labelHe,
    steps: showDose ? plan.steps! : defaultSteps,
    product: showDose ? plan.product : undefined,
    materialNote: showDose ? plan.materialNote : undefined,
    calculationNote: showDose ? plan.calculationNote : undefined,
    prerequisiteHe: showDose ? plan.prerequisiteHe : undefined,
    policyVersion: TREATMENT_POLICY_VERSION,
  } : undefined;
  const currentPlanKey = currentPlan ? treatmentPlanContentKey(currentPlan) : '';
  const savedPlanKey = savedPlan ? treatmentPlanContentKey(savedPlan) : '';
  useEffect(() => {
    // Save the proposal BEFORE the user records performing it. Preserve an
    // existing numeric archive when eligibility expires or the screen changes.
    if (!editableCurrentResult || !historyHydrated || used || !currentPlan ||
        result.accepted !== true || result.isValidStrip !== true || result.lowConfidence ||
        (!showDose && savedPlan) || currentPlanKey === savedPlanKey ||
        persistedPlanKey.current === currentPlanKey) return;
    persistedPlanKey.current = currentPlanKey;
    saveAnalysisResult({ ...result, treatmentPlan: currentPlan });
  }, [editableCurrentResult, historyHydrated, used, currentPlanKey, savedPlanKey,
    showDose, saveAnalysisResult, result]);
  // History keeps an original saved scan proposal readable. Never reconstruct a
  // past quantity using today's pool settings or request manual water readings.
  // Without an archive, general directions can still explain the treatment
  // route. They start with current measurement and retain conditional wording.
  const displayedPlan = showDose ? currentPlan : savedPlan ?? performedPlan;
  const historicalGeneralSteps = isHistorical && !displayedPlan && primary?.guidance
    ? [primary.guidance.verification, primary.guidance.action, primary.guidance.followUp] : undefined;
  // The execution ledger alone is not a validated original instruction archive.
  // In particular, never relabel a legacy manual shock as scan-derived guidance.
  const steps = displayedPlan?.steps ?? historicalGeneralSteps ?? plan.steps ?? defaultSteps;
  const archivedView = Boolean(displayedPlan && !showDose);
  const requestConsent = !consentCurrent && !used && Boolean(editableCurrentResult && candidatePlan.product);
  const formatDate = (at: number) => new Date(at).toLocaleString('he-IL', {
    day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  // Shorten only the known numeric template. Keep original stored instructions
  // intact and available below; unfamiliar historical instructions stay verbatim.
  const product = displayedPlan?.product;
  const condensed = Boolean(product && steps.length === 4 &&
    steps[0] === `הוסף ${product.amount.toLocaleString('he-IL')} ${product.unit} ${product.labelHe}, לפי אופן ההוספה שבתווית וללא רוחצים.` &&
    steps[1] === 'הפעל סחרור לפי הוראות המוצר והמערכת. אין לערבב חומרים.' &&
    steps[3] === 'בצע בדיקה חדשה. אל תוסיף מנה נוספת לפי התוצאה הזו.');
  const visibleSteps = condensed ? [
    'הוסף את הכמות המוצגת לפי התווית, ללא רוחצים.',
    steps[1],
    `${steps[2]} ${steps[3]}`,
  ] : steps;

  async function markPerformed() {
    if (!showDose || !consentCurrent || !pool || !plan.product || !plan.steps || lock.current) return;
    // Recheck time and treatment history at the tap, even after backgrounding.
    const freshPlan = buildStagedDose(result, pool, { now: Date.now(), waterTestIsCurrent,
      historical: isHistorical || !allowRecord, latestTreatmentAt: latest?.performedAt,
      latestDoseRetestNotBefore: latest?.doseRetestNotBefore,
      latestTreatmentRequiresDpdFollowUp: latest?.requiresDpdFollowUp, latestDpdFollowUpAt: latest?.dpdFollowUp?.measuredAt,
    });
    if (!freshPlan.product) { setNow(Date.now()); return; }
    lock.current = true;
    setBusy(true);
    // This button is tapped AFTER adding the dose. Disable it even on storage
    // errors, while retaining the instructions as a readable archive.
    setPerformedHere(true);
    setPerformedPlan(currentPlan);
    try {
      const performedAt = Date.now();
      await saveTreatment({ testId, poolId: pool.id,
        actionText: freshPlan.steps![0], performedAt,
        doseRetestNotBefore: freshPlan.retestMinimumHours
          ? performedAt + freshPlan.retestMinimumHours * 60 * 60 * 1000 : undefined });
    } catch (caught) {
      setSaveError(`${caught instanceof Error ? caught.message : 'התיעוד לא נשמר.'} אם הוספת חומר, אל תוסיף שוב; שמור תיעוד ידני ובצע בדיקה חדשה.`);
    } finally { lock.current = false; setBusy(false); }
  }

  return <>
    {isHistorical && !displayedPlan ? <Text style={styles.note}>הנחיות כלליות לפי הבדיקה הקודמת. לפני הוספת חומר נדרשת בדיקה עדכנית.</Text> : null}
    {displayedPlan && !used && archivedView ? <View style={styles.archiveHeader}>
      <Text style={styles.note}>ההנחיות ממועד הבדיקה, לעיון. לפני טיפול נוסף נדרשת סריקה עדכנית.</Text>
      {archivedView ? <Text style={styles.status}>{hydrated ? 'טרם סומן כבוצע במכשיר הזה' : 'טוען את סטטוס הביצוע…'}</Text> : null}
    </View> : null}
    {used ? <View style={styles.prerequisite}>
      <Text style={styles.label}>סומן כבוצע במכשיר הזה</Text>
      <Text style={styles.note}>אין להוסיף שוב את המנה. ההוראות נשארות לתיעוד.</Text>
      {treatment?.doseRetestNotBefore ? <Text style={styles.note}>בדיקה למנה נוספת מ־{formatDate(treatment.doseRetestNotBefore)}, או מאוחר יותר לפי התווית.</Text> : null}
    </View> : null}
    {displayedPlan?.prerequisiteHe ? <View style={styles.prerequisite}>
      <Text style={styles.label}>לפני הוספת החומר</Text>
      <Text style={styles.note}>{displayedPlan.prerequisiteHe}</Text>
    </View> : null}
    {displayedPlan?.product ? <View style={styles.material}>
      <View style={styles.materialRow}>
        <View style={styles.materialIdentity}>
          <Text style={styles.materialLabel}>{archivedView ? 'הכמות שנשמרה' : 'מנת פתיחה להוספה'}</Text>
          <Text style={styles.productName}>{displayedPlan.product.labelHe}</Text>
        </View>
        <Text style={styles.amount}>{displayedPlan.product.amount.toLocaleString('he-IL')} <Text style={styles.unit}>{displayedPlan.product.unit}</Text></Text>
      </View>
      {displayedPlan.volumeLiters ? <Text style={styles.volumeBasis}>לבריכה של {displayedPlan.volumeLiters.toLocaleString('he-IL')} ליטר</Text> : null}
      {displayedPlan.product.key === 'chlorineLiquid10' ? <Text style={styles.note}>בריכוז 120 גרם כלור פעיל לליטר בלבד.</Text> : null}
      {displayedPlan.product.key === 'acidHCl' ? <Text style={styles.note}>בריכוז 33% משקלי בלבד.</Text> : null}
    </View> : null}
    {!used && !isHistorical && plan.reason ? <Text style={styles.note}>{plan.reason}</Text> : null}
    <TreatmentSteps steps={visibleSteps} compact />
    {!used && waitingForLedger ? <Text style={styles.note}>טוען את תיעוד הביצוע לפני הפעלת הכפתור.</Text> : null}
    {requestConsent && !isHistorical ?
      <PrimaryButton variant="refined" label="עדכון אישור תנאי השימוש" busy={checkingConsent}
        onPress={() => { void refreshConsent().catch(() => {}); }} /> : null}
    {plan.needsCurrentWaterConfirmation && editableCurrentResult && !used ?
      <PrimaryButton variant="refined" label="זו בדיקה עדכנית של המים, לפני טיפול" icon="check"
        onPress={() => { setWaterTestIsCurrent(true); setNow(Date.now()); }} /> : null}
    {showDose ? <PrimaryButton variant="refined" label="הוספתי את המנה" icon="check" busy={busy} onPress={() => { void markPerformed(); }} /> : null}
    {displayedPlan?.product ?
      <DisclosureSection title="פרטי החומר וההנחיות" variant="quiet">
        {displayedPlan ? <>
          <Text style={styles.note}>ההנחיות הוצעו ב־{formatDate(displayedPlan.proposedAt)} ונשמרו לבדיקה.</Text>
          {displayedPlan.materialNote ? <Text style={styles.note}>{displayedPlan.materialNote}</Text> : null}
          {displayedPlan.product ? <Text style={styles.note}>אם הריכוז או נפח הבריכה שונים, אל תשתמש בכמות הזו. תווית המוצר קודמת לחישוב.</Text> : null}
          {displayedPlan.calculationNote ? <>
            <Text style={styles.note}>{displayedPlan.calculationNote}</Text>
            <Text style={styles.note}>מנה חלקית אינה מבטיחה שלא ייגרם נזק. הטיפול הבא ייקבע לפי בדיקה חדשה.</Text>
          </> : null}
        </> : null}
        {condensed ? <TreatmentSteps steps={steps} compact /> : null}
        <Text style={styles.note}>כפתור הביצוע מיועד לסימון אחרי הוספת המנה. התיעוד נשמר במכשיר הזה.</Text>
      </DisclosureSection> : null}
    {editableCurrentResult && (!pool || !Number.isFinite(pool.volumeLiters) || pool.volumeLiters <= 0) ?
      <Pressable accessibilityRole="button" onPress={onEditPool} style={styles.linkButton}>
        <Text style={styles.link}>השלמת נפח הבריכה</Text>
      </Pressable> : null}
    {editableCurrentResult && error ? <Text style={styles.note}>{error}</Text> : null}
    {saveError ? <Text accessibilityLiveRegion="polite" style={styles.note}>{saveError}</Text> : null}
    {syncError ? <Text style={styles.note}>{syncError}</Text> : null}
  </>;
}

const styles = StyleSheet.create({
  archiveHeader: { gap: 4 },
  status: { color: colors.primaryDeep, fontFamily: typography.fontFamilyMedium, fontSize: 12, lineHeight: 20, ...rtl.text },
  prerequisite: { borderRadius: 12, padding: 12, gap: 5, backgroundColor: colors.warningSoft },
  material: { borderRadius: 17, padding: 14, gap: 7, backgroundColor: '#EDF8FB', borderWidth: 1, borderColor: '#DCEFF4' },
  materialRow: { ...rtl.row, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  materialIdentity: { flexGrow: 1, flexBasis: 125, minWidth: 0, gap: 2 },
  materialLabel: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 11, lineHeight: 18, ...rtl.text },
  amount: { flexShrink: 0, color: '#123E55', fontFamily: typography.fontFamilyBold, fontSize: 34, lineHeight: 45,
    fontVariant: ['tabular-nums'], ...rtl.text },
  unit: { fontSize: 15, color: '#4F7386', fontFamily: typography.fontFamilyMedium },
  productName: { color: colors.text, fontFamily: typography.fontFamilyMedium, fontSize: 14, lineHeight: 22, ...rtl.text },
  volumeBasis: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, lineHeight: 20, ...rtl.text },
  label: { color: colors.primaryDeep, fontFamily: typography.fontFamilySemiBold, fontSize: 13, lineHeight: 21, ...rtl.text },
  note: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, lineHeight: 20, ...rtl.text },
  linkButton: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  link: { color: colors.primaryDeep, fontFamily: typography.fontFamilySemiBold, ...rtl.text },
});
