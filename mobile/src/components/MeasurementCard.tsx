import { StyleSheet, Text, View } from 'react-native';
import type { PadColor } from '../domain/padColor';
import { colors, rtl, typography } from '../theme';
import { PadColorSwatch } from './PadColorSwatch';

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
  label, value, status, tone, detail, note, padColor, showPadColor = true,
}: {
  label: string;
  value: string;
  status: string;
  tone: MeasurementTone;
  detail?: string;
  note?: string;
  padColor?: PadColor;
  showPadColor?: boolean;
}) {
  const palette = TONES[tone];
  return (
    <View style={[styles.card, (tone === 'warning' || tone === 'danger') &&
      { borderColor: tone === 'danger' ? '#F1C8CB' : '#E8D4A5' }]}>
      <View style={styles.readingRow}>
        <View style={styles.identity}>
          {showPadColor ? <PadColorSwatch color={padColor} hidePhotoLabel /> : null}
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.value}>{value}</Text>
      </View>
      <View style={styles.detailsRow}>
        <View style={[styles.status, { backgroundColor: palette.background }]}>
          <View style={[styles.dot, { backgroundColor: palette.color }]} />
          <Text style={[styles.statusText, { color: palette.color }]}>{status}</Text>
        </View>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 15 },
  readingRow: { ...rtl.row, alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  identity: { ...rtl.row, flex: 1, minWidth: 135, alignItems: 'center', gap: 10 },
  label: { flexShrink: 1, color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 16, ...rtl.text },
  value: { color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 25, ...rtl.text },
  detailsRow: {
    ...rtl.row, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
    gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 10,
  },
  status: { ...rtl.row, alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: typography.fontFamilySemiBold, fontSize: 11, ...rtl.text },
  detail: { flexShrink: 1, color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, ...rtl.text },
  note: { marginTop: 7, color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, lineHeight: 19, ...rtl.text },
});
