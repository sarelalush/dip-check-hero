import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PadColor } from '../domain/padColor';
import { colors, rtl, typography } from '../theme';
import { PadColorSwatch } from './PadColorSwatch';
import { LineIcon } from './LineIcon';

export type MeasurementTone = 'success' | 'warning' | 'danger' | 'neutral';

const TONES = {
  success: { color: '#137D58', background: colors.successSoft },
  warning: { color: '#8A5600', background: colors.warningSoft },
  danger: { color: '#AA333A', background: colors.dangerSoft },
  neutral: { color: colors.primaryDeep, background: colors.backgroundSoft },
};

// Colour identity, value and review status stay separate: a green pad is never
// itself an "OK" indicator. Every measured pad shares this explicit RTL layout.
export function MeasurementCard({
  label, description, explanation, padPosition, value, status, tone, detail, notice, note, detailNote, padColor, showPadColor = true,
}: {
  label: string;
  description?: string;
  explanation?: string;
  padPosition?: number;
  value: string;
  status: string;
  tone: MeasurementTone;
  detail?: string;
  notice?: string;
  note?: string;
  detailNote?: string;
  padColor?: PadColor;
  showPadColor?: boolean;
}) {
  const palette = TONES[tone];
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[styles.card, (tone === 'warning' || tone === 'danger') &&
      { borderColor: tone === 'danger' ? '#F1C8CB' : '#E8D4A5' }]}>
      <View style={styles.readingRow}>
        <View style={styles.identity}>
          {showPadColor ? <PadColorSwatch color={padColor} hidePhotoLabel /> : null}
          <View style={styles.identityCopy}>
            <Text style={styles.label}>{label}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
        </View>
        <View style={styles.valueBlock}>
          <Text style={styles.value}>{value}</Text>
          {padPosition ? <Text style={styles.padPosition}>ריבוע {padPosition} בסטיק</Text> : null}
        </View>
      </View>
      <View style={styles.detailsRow}>
        <View style={[styles.status, { backgroundColor: palette.background }]}>
          <LineIcon name={tone === 'success' ? 'check' : 'help'} color={palette.color} size={12} />
          <Text style={[styles.statusText, { color: palette.color }]}>{status}</Text>
        </View>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {notice ? <View style={styles.notice}>
        <LineIcon name="help" color="#8A5600" size={14} />
        <Text style={styles.noticeText}>{notice}</Text>
      </View> : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {explanation || detailNote ? <>
        <Pressable accessibilityRole="button" accessibilityLabel={`הסבר על ${label}`}
          accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)}
          style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
          <Text style={styles.moreText}>{expanded ? 'סגירת ההסבר' : 'מה זה אומר?'}</Text>
          <LineIcon name={expanded ? 'chevronUp' : 'chevronDown'} color={colors.primaryDeep} size={14} />
        </Pressable>
        {expanded ? <View style={styles.explanation}>
          {explanation ? <Text style={styles.explanationText}>{explanation}</Text> : null}
          {detailNote ? <Text style={styles.explanationText}>{detailNote}</Text> : null}
        </View> : null}
      </> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16 },
  readingRow: { ...rtl.row, alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  identity: { ...rtl.row, flex: 1, minWidth: 150, alignItems: 'center', gap: 10 },
  identityCopy: { flex: 1, gap: 3 },
  label: { flexShrink: 1, color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 16, ...rtl.text },
  description: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, lineHeight: 19, ...rtl.text },
  valueBlock: { gap: 2 },
  value: { color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 24, ...rtl.text },
  padPosition: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 10, ...rtl.text },
  detailsRow: {
    ...rtl.row, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
    gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 10,
  },
  status: { ...rtl.row, maxWidth: '100%', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { flexShrink: 1, fontFamily: typography.fontFamilySemiBold, fontSize: 12, ...rtl.text },
  detail: { flexShrink: 1, color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, ...rtl.text },
  notice: { ...rtl.row, alignItems: 'flex-start', gap: 5, backgroundColor: colors.warningSoft,
    padding: 9, borderRadius: 10, marginTop: 10 },
  noticeText: { flex: 1, color: '#8A5600', fontFamily: typography.fontFamilyMedium, fontSize: 12, lineHeight: 20, ...rtl.text },
  note: { marginTop: 9, color: colors.text, fontFamily: typography.fontFamilyRegular, fontSize: 13, lineHeight: 21, ...rtl.text },
  moreButton: { ...rtl.row, alignSelf: 'flex-end', alignItems: 'center', minHeight: 44, gap: 4,
    marginTop: 2, paddingHorizontal: 4, borderRadius: 8 },
  moreText: { color: colors.primaryDeep, fontFamily: typography.fontFamilyMedium, fontSize: 12, ...rtl.text },
  pressed: { backgroundColor: colors.backgroundSoft },
  explanation: { borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 10, gap: 7 },
  explanationText: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 13, lineHeight: 22, ...rtl.text },
});
