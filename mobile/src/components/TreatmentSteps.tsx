import { StyleSheet, Text, View } from 'react-native';
import { colors, rtl, typography } from '../theme';

export function TreatmentSteps({ steps, compact = false }: { steps: string[]; compact?: boolean }) {
  return (
    <View style={styles.steps} accessibilityLabel="שלבי הפעולה לפי הסדר">
      {steps.map((step, index) => (
        <View key={`${index}-${step}`} style={[styles.row, index === 0 && styles.firstRow, compact && styles.compactRow]}>
          {compact && index < steps.length - 1 ? <View pointerEvents="none" style={styles.connector} /> : null}
          <View style={[styles.number, index === 0 && styles.firstNumber, compact && styles.compactNumber]}>
            <Text style={[styles.numberText, index === 0 && styles.firstNumberText, compact && styles.compactNumberText]}>{index + 1}</Text>
          </View>
          <Text style={[styles.text, index === 0 && styles.firstText, compact && styles.compactText]}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { gap: 8 },
  row: { ...rtl.row, alignItems: 'flex-start', gap: 10, backgroundColor: colors.surfaceSoft,
    padding: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.borderSoft },
  firstRow: { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong },
  compactRow: { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, paddingVertical: 5 },
  connector: { position: 'absolute', right: 10.5, top: 30, bottom: -10, width: 1, backgroundColor: '#DEEDF3' },
  compactNumber: { width: 22, height: 22, borderRadius: 7, backgroundColor: '#EFF8FB' },
  compactNumberText: { color: colors.primaryDeep, fontSize: 11 },
  compactText: { fontSize: 13, lineHeight: 22, fontFamily: typography.fontFamilyRegular },
  number: {
    width: 26, height: 26, borderRadius: 9, backgroundColor: colors.backgroundDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  firstNumber: { backgroundColor: colors.primaryDeep },
  numberText: { color: colors.primaryDeep, fontFamily: typography.fontFamilyBold, fontSize: 13 },
  firstNumberText: { color: colors.white },
  text: { flex: 1, color: colors.text, fontFamily: typography.fontFamilyRegular,
    fontSize: 14, lineHeight: 23, ...rtl.text },
  firstText: { fontFamily: typography.fontFamilySemiBold },
});
