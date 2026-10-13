import { StyleSheet, Text, View } from 'react-native';
import { colors, rtl, typography } from '../theme';

export function TreatmentSteps({ steps }: { steps: string[] }) {
  return (
    <View style={styles.steps} accessibilityLabel="שלבי הפעולה לפי הסדר">
      {steps.map((step, index) => (
        <View key={`${index}-${step}`} style={styles.row}>
          <View style={styles.number}>
            <Text style={styles.numberText}>{index + 1}</Text>
          </View>
          <Text style={styles.text}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { gap: 12 },
  row: { ...rtl.row, alignItems: 'flex-start', gap: 10 },
  number: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  numberText: { color: colors.white, fontFamily: typography.fontFamilyBold, fontSize: 13 },
  text: { flex: 1, color: colors.text, fontFamily: typography.fontFamilySemiBold,
    fontSize: 14, lineHeight: 23, ...rtl.text },
});
