import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, rtl, typography } from '../theme';
import { LineIcon } from './LineIcon';

interface AppHeaderProps {
  onNotificationPress?: () => void;
}

export function AppHeader({ onNotificationPress }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onNotificationPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <LineIcon name="bell" color={colors.textSoft} size={20} />
      </Pressable>

      <View style={styles.brand}>
        <View style={styles.logoMark}>
          <View style={styles.logoDrop} />
        </View>
        <View>
          <Text style={styles.logoTitle}>AquaSense</Text>
          <Text style={styles.logoSub}>AquaSense</Text>
        </View>
      </View>

      <View style={styles.iconButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    position: 'relative',
    zIndex: 5,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 9,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoDrop: {
    width: 13,
    height: 20,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
    transform: [{ rotate: '35deg' }],
  },
  logoTitle: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
    fontSize: 17,
    fontWeight: '900',
    ...rtl.text,
  },
  logoSub: {
    display: 'none',
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    fontWeight: '900',
    ...rtl.text,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
