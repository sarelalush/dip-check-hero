import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, rtl, spacing, typography } from '../theme';

export function Header() {
  return (
    <View style={styles.wrap}>
      <View style={styles.logo}>
        <View style={styles.logoDrop} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.brand}>AQUASENSE</Text>
        <Text style={styles.subtitle}>ניהול חכם לבריכה</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  logoDrop: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 4,
    height: 32,
    transform: [{ rotate: '45deg' }],
    width: 25,
  },
  copy: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  brand: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: typography.brandSpacing,
    ...rtl.textCenter,
  },
  subtitle: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '800',
    marginTop: spacing.xs,
    ...rtl.textCenter,
  },
});
