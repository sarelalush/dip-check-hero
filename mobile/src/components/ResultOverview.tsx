import { StyleSheet, Text, View } from 'react-native';
import type { StripAnalysisResult } from '../domain/scanResults';
import { getChlorineReview } from '../domain/readingComparison';
import { resultStatus } from '../domain/resultPresentation';
import { colors, rtl, typography } from '../theme';
import { LineIcon } from './LineIcon';

export function ResultOverview({ result, poolName, metadata, isHistorical }: {
  result: StripAnalysisResult;
  poolName: string;
  metadata: string;
  isHistorical: boolean;
}) {
  const status = resultStatus(result);
  const chlorineReview = getChlorineReview(result.parameters);
  const inRange = status.tone === 'success';
  const partial = status.tone === 'neutral';
  const title = inRange ? 'המדדים בטווח לפי הצילום'
    : chlorineReview?.reason === 'inconsistent' ? 'קריאות הכלור לא תואמות'
    : chlorineReview?.reason === 'gap' ? 'יש פער בין סוגי הכלור'
    : partial ? 'חסרים נתונים לבדיקה מלאה'
    : status.label === 'כלור כולל מחוץ לטווח ההשוואה' ? 'הכלור הכולל מחוץ לטווח'
    : status.label === 'קריאה בין טווחים' ? 'חלק מהצבעים בין שתי דרגות'
    : 'יש מדד שכדאי לאזן';
  const description = inRange ? 'לפי הקריאה, אין כרגע צורך לתקן את המדדים שנבדקו.'
    : chlorineReview?.reason === 'inconsistent' ? 'צריך לבדוק שוב את שני סוגי הכלור לפני בחירת טיפול.'
    : chlorineReview?.reason === 'gap' ? 'ייתכן שחלק מהכלור כבר הגיב במים. סדר הפעולות מופיע כאן למטה.'
    : partial ? 'השלם את המדדים החסרים לפני בחירת טיפול.'
    : status.label === 'כלור כולל מחוץ לטווח ההשוואה' ? 'קוראים אותו יחד עם הכלור החופשי כדי לבחור טיפול מתאים.'
    : status.label === 'קריאה בין טווחים' ? 'בדיקה נוספת של המדדים המסומנים תעזור לבחור את הטיפול.'
    : 'מתקנים מדד אחד בכל פעם. מתחילים בפעולה שמופיעה כאן למטה.';
  const accent = inRange ? '#137D58' : partial ? colors.primaryDeep : '#8A5600';

  return (
    <View style={styles.overview}>
      <View style={styles.metaRow}>
        <Text style={styles.poolName}>{poolName}</Text>
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceText}>{isHistorical ? 'בדיקה מההיסטוריה' : 'הערכה מצילום'}</Text>
        </View>
      </View>
      <Text style={styles.metadata}>{metadata}</Text>
      <View style={[styles.summary, { borderRightColor: accent }]}>
        <View style={styles.heading}>
          <View style={[styles.icon, { backgroundColor: inRange ? colors.successSoft : partial ? colors.primarySoft : colors.warningSoft }]}>
            <LineIcon name={inRange ? 'check' : 'help'} color={accent} size={20} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.kicker}>מה מצב המים?</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>
        <Text style={styles.description}>{description}</Text>
        <Text style={styles.note}>{isHistorical
          ? 'זו תוצאה ממועד הצילום. לפני טיפול צריך בדיקה עדכנית.'
          : 'הקריאה היא הערכה מהצילום, ואינה אישור לרחצה.'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overview: { marginTop: 14, gap: 7 },
  metaRow: { ...rtl.row, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  poolName: { flexShrink: 1, color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 18, ...rtl.text },
  sourceBadge: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  sourceText: { color: colors.textSoft, fontFamily: typography.fontFamilyMedium, fontSize: 11, ...rtl.text },
  metadata: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, ...rtl.text },
  summary: { marginTop: 5, padding: 17, gap: 10, backgroundColor: colors.surface, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, borderRightWidth: 4 },
  heading: { ...rtl.row, alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  kicker: { color: colors.textSoft, fontFamily: typography.fontFamilyMedium, fontSize: 12, ...rtl.text },
  title: { color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 21, lineHeight: 30, ...rtl.text },
  description: { color: colors.text, fontFamily: typography.fontFamilyRegular, fontSize: 14, lineHeight: 23, ...rtl.text },
  note: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, lineHeight: 20, ...rtl.text },
});
