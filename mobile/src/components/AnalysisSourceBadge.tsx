import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, rtl, typography } from '../theme';
import type { StripAnalysisResult } from '../domain/scanResults';

function sourceLabel(source: StripAnalysisResult['source']) {
  if (source === 'ai') return 'ניתוח AI';
  if (source === 'cv') return 'ניתוח פיקסלים';
  if (source === 'remote-v1') return 'ניתוח מרוחק';
  return 'ערכי דמו';
}

function sourceTone(source: StripAnalysisResult['source']) {
  if (source === 'ai') return { backgroundColor: colors.successSoft, color: colors.success };
  if (source === 'cv' || source === 'remote-v1') return { backgroundColor: colors.warningSoft, color: colors.warning };
  return { backgroundColor: colors.subtle, color: colors.textSoft };
}

interface AnalysisSourceBadgeProps {
  result: StripAnalysisResult;
}

export function AnalysisSourceBadge({ result }: AnalysisSourceBadgeProps) {
  const tone = sourceTone(result.source);
  const confidence = typeof result.confidence === 'number' ? `${Math.round(result.confidence * 100)}%` : undefined;
  const detailParts = [result.provider, result.model, typeof result.shotsUsed === 'number' ? `${result.shotsUsed} ניתוחים` : undefined].filter(Boolean);

  return (
    <View style={styles.wrap}>
      <View style={[styles.badge, { backgroundColor: tone.backgroundColor }]}>
        <Text style={[styles.badgeText, { color: tone.color }]}>{sourceLabel(result.source)}</Text>
      </View>
      {confidence ? <Text style={styles.confidence}>ביטחון {confidence}</Text> : null}
      {detailParts.length ? <Text style={styles.details}>{detailParts.join(' · ')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  badge: {
    borderRadius: radius.round,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  badgeText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  confidence: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 11,
    fontWeight: '900',
    ...rtl.text,
  },
  details: {
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    fontWeight: '800',
    ...rtl.text,
  },
});
