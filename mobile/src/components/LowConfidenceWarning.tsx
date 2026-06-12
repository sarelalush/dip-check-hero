import { StyleSheet, Text, View } from 'react-native';
import { colors, rtl, typography } from '../theme';
import { LineIcon } from './LineIcon';

interface LowConfidenceWarningProps {
  notes?: string;
}

export function LowConfidenceWarning({ notes }: LowConfidenceWarningProps) {
  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <LineIcon name="help" color={colors.warning} size={15} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>ביטחון נמוך בתוצאה</Text>
        <Text style={styles.text}>
          שני צילומים של אותו סטיק עלולים לתת ערכים שונים. לצילום מדויק יותר כדאי לצלם באור יום טבעי, על רקע לבן, כשהסטיק שטוח וקרוב.
        </Text>
        {notes ? <Text style={styles.notes}>{notes}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(240,165,41,0.34)',
    backgroundColor: colors.warningSoft,
    padding: 13,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.text,
  },
  text: {
    marginTop: 4,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 17,
    ...rtl.text,
  },
  notes: {
    marginTop: 7,
    color: colors.warning,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 17,
    ...rtl.text,
  },
});
