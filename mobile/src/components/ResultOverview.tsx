import { StyleSheet, Text, View } from 'react-native';
import type { StripAnalysisResult } from '../domain/scanResults';
import { getChlorineReview } from '../domain/readingComparison';
import { resultStatus } from '../domain/resultPresentation';
import { MEASUREMENT_COPY } from '../domain/measurementPresentation';
import { totalChlorinePresentation } from '../domain/chlorinePresentation';
import { colors, rtl, shadows, typography } from '../theme';
import { LineIcon } from './LineIcon';
import { ParameterArcs, type ParameterArcReading } from './ParameterArcs';

export function ResultOverview({ result, poolName, metadata, isHistorical, readings, volumeLiters }: {
  result: StripAnalysisResult;
  poolName: string;
  metadata: string;
  isHistorical: boolean;
  readings: ParameterArcReading[];
  volumeLiters?: number;
}) {
  const status = resultStatus(result);
  const chlorineReview = getChlorineReview(result.parameters);
  const totalChlorine = totalChlorinePresentation(result.parameters.find(parameter => parameter.key === 'totalChlorine'));
  const usesUpperCandidate = totalChlorine?.usesUpperCandidate === true;
  const upperSummary = usesUpperCandidate && !chlorineReview &&
    ['קריאה בין טווחים', 'כלור כולל מחוץ לטווח ההשוואה', 'הערכים בטווח לפי ההערכה'].includes(status.label);
  const upperHigh = upperSummary && totalChlorine?.kind === 'high';
  const inRange = status.tone === 'success' && (!totalChlorine || totalChlorine.kind === 'ok');
  const partial = status.tone === 'neutral';
  const title = inRange ? isHistorical ? 'המדדים היו בטווח בבדיקה' : 'המדדים בטווח'
    : status.label === 'נדרש צילום חוזר' ? 'צריך צילום חוזר'
    : chlorineReview?.reason === 'inconsistent' ? 'קריאות הכלור לא תואמות'
    : chlorineReview?.reason === 'gap' ? 'יש פער בין סוגי הכלור'
    : partial ? 'חסרים נתונים לבדיקה מלאה'
    : upperHigh ? 'הכלור הכולל עשוי להיות גבוה'
    : status.label === 'כלור כולל מחוץ לטווח ההשוואה' ? 'הכלור הכולל מחוץ לטווח'
    : status.label === 'קריאה בין טווחים' ? 'יש יותר מהתאמה אחת למקרא'
    : 'יש מדדים שצריך לאזן';
  const pill = inRange ? 'בטווח' : partial ? 'בדיקה חלקית'
    : status.label === 'נדרש צילום חוזר' ? 'צילום חוזר' : chlorineReview ? 'פער בכלור'
    : upperHigh ? 'הערכה מחמירה'
    : status.label === 'קריאה בין טווחים' ? 'הערכה מצילום' : 'נדרש טיפול';
  const palette = inRange ? { color: '#238568', backgroundColor: colors.successSoft }
    : partial ? { color: colors.primaryDeep, backgroundColor: colors.primarySoft }
    : upperHigh ? { color: '#A23C4C', backgroundColor: colors.dangerSoft }
    : { color: '#946023', backgroundColor: colors.warningSoft };
  const primary = result.dosage?.primaryRecommendation;
  const additionalAction = primary && !readings.some(reading => reading.paramKey === primary.paramKey)
    ? MEASUREMENT_COPY[primary.paramKey].label : undefined;
  const showVolume = !isHistorical && typeof volumeLiters === 'number' && Number.isFinite(volumeLiters) && volumeLiters > 0;

  return (
    <View style={styles.overview}>
      <View style={styles.brandRow}>
        <View style={styles.brand}>
          <View style={styles.brandMark}><LineIcon name="drop" size={15} color={colors.white} /></View>
          <Text style={styles.brandText}>Aqua<Text style={styles.brandAccent}>Sense</Text></Text>
        </View>
        <Text style={styles.metadata}>{metadata}</Text>
      </View>
      <View style={styles.metaRow}>
        <View style={styles.poolCopy}>
          <Text style={styles.poolName}>{poolName}</Text>
          <Text style={styles.pageTitle}>תוצאות הבדיקה</Text>
        </View>
        {isHistorical ? <View style={styles.historyPill}>
          <LineIcon name="history" size={12} color={colors.primaryDeep} />
          <Text style={styles.historyText}>מההיסטוריה</Text>
        </View> : showVolume ? <View style={styles.volumePill}><LineIcon name="pools" size={12} color={colors.primaryDeep} /><Text style={styles.volumeText}>
          {(volumeLiters! / 1000).toLocaleString('he-IL', { maximumFractionDigits: 2 })} מ״ק
        </Text></View> : null}
      </View>
      <View style={styles.chartCard}>
        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
          <View style={[styles.statusPill, { backgroundColor: palette.backgroundColor }]}>
            <View style={[styles.statusDot, { backgroundColor: palette.color }]} />
            <Text style={[styles.statusText, { color: palette.color }]}>{pill}</Text>
          </View>
        </View>
        <ParameterArcs recs={readings} />
        {additionalAction ? <View style={styles.focus}>
          <LineIcon name="flash" size={13} color={colors.primaryDeep} />
          <Text style={styles.focusText}>הצעד הבא: טיפול ב{additionalAction}</Text>
        </View> : null}
        <Text style={styles.photoNote}>{usesUpperCandidate
          ? 'בכלור הכולל מוצגת האפשרות הגבוהה מבין שתי התאמות למקרא'
          : isHistorical ? 'הערכה מצילום במועד הבדיקה' : 'הערכה לפי צילום הסטיק'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overview: { marginTop: 10, gap: 20 },
  brandRow: { ...rtl.row, alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { ...rtl.row, alignItems: 'center', gap: 7 },
  brandMark: { width: 31, height: 31, borderRadius: 11, backgroundColor: '#087E99', alignItems: 'center', justifyContent: 'center' },
  brandText: { color: '#143B52', fontFamily: typography.fontFamilyBold, fontSize: 15, writingDirection: 'ltr' },
  brandAccent: { color: colors.primaryDeep },
  metadata: { flexShrink: 1, color: '#4B6578', fontFamily: typography.fontFamilyRegular, fontSize: 11, lineHeight: 18, ...rtl.text },
  metaRow: { ...rtl.row, alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  poolCopy: { flex: 1, gap: 3 },
  poolName: { color: '#4B6578', fontFamily: typography.fontFamilyRegular, fontSize: 12, lineHeight: 20, ...rtl.text },
  pageTitle: { color: '#14374D', fontFamily: typography.fontFamilyBold, fontSize: 27, lineHeight: 38, ...rtl.text },
  historyPill: { ...rtl.row, alignItems: 'center', gap: 3, backgroundColor: '#E1F1F6', borderRadius: 13,
    paddingHorizontal: 9, paddingVertical: 7 },
  historyText: { color: colors.primaryDeep, fontFamily: typography.fontFamilyMedium, fontSize: 11, ...rtl.text },
  volumePill: { ...rtl.row, alignItems: 'center', gap: 4, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: '#E0EDF2', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  volumeText: { color: colors.textSoft, fontFamily: typography.fontFamilyMedium, fontSize: 12, ...rtl.text },
  chartCard: { padding: 19, gap: 17, borderRadius: 28, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: '#E4EEF3', ...shadows.soft, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08, shadowRadius: 25, elevation: 4 },
  heading: { ...rtl.row, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  title: { flexGrow: 1, flexBasis: 150, color: '#183D53', fontFamily: typography.fontFamilyBold, fontSize: 18, lineHeight: 27, ...rtl.text },
  statusPill: { ...rtl.row, alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontFamily: typography.fontFamilyMedium, fontSize: 11, lineHeight: 18, ...rtl.text },
  photoNote: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 11, lineHeight: 18, ...rtl.textCenter },
  focus: { ...rtl.row, alignItems: 'center', gap: 4 },
  focusText: { flex: 1, color: colors.primaryDeep, fontFamily: typography.fontFamilyMedium, fontSize: 12, lineHeight: 20, ...rtl.text },
});
