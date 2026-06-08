import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NavigationProp } from '@react-navigation/native';
import { colors, layout, radius, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type TabKey = 'home' | 'pools' | 'scan' | 'history' | 'settings';

interface Props {
  active: TabKey;
  navigation: NavigationProp<RootStackParamList>;
}

const SIDE_TABS: { key: Exclude<TabKey, 'scan'>; label: string; icon: string }[] = [
  { key: 'settings', label: 'הגדרות', icon: '⚙' },
  { key: 'history', label: 'היסטוריה', icon: '◷' },
  { key: 'pools', label: 'בריכות', icon: '≈' },
  { key: 'home', label: 'בית', icon: '⌂' },
];

export function BottomTabBar({ active, navigation }: Props) {
  function go(tab: TabKey) {
    if (tab === 'home') navigation.navigate('Dashboard');
    else if (tab === 'pools') navigation.navigate('PoolsList');
    else if (tab === 'scan') navigation.navigate('SelectStrip');
    else if (tab === 'history') navigation.navigate('History');
    else if (tab === 'settings') navigation.navigate('Settings');
  }

  return (
    <View pointerEvents="box-none" style={styles.safeArea}>
      <View style={styles.shell}>
        <View style={styles.sideGroup}>
          {SIDE_TABS.slice(0, 2).map((tab) => (
            <TabItem key={tab.key} tab={tab} active={active === tab.key} onPress={() => go(tab.key)} />
          ))}
        </View>

        <Pressable onPress={() => go('scan')} style={({ pressed }) => [styles.scanWrap, pressed && styles.pressed]}>
          <View style={styles.scanGlow} />
          <View style={[styles.scanButton, active === 'scan' && styles.scanButtonActive]}>
            <Text style={styles.scanIcon}>⌁</Text>
          </View>
          <Text style={styles.scanLabel}>סריקה</Text>
        </Pressable>

        <View style={styles.sideGroup}>
          {SIDE_TABS.slice(2).map((tab) => (
            <TabItem key={tab.key} tab={tab} active={active === tab.key} onPress={() => go(tab.key)} />
          ))}
        </View>
      </View>
    </View>
  );
}

function TabItem({
  tab,
  active,
  onPress,
}: {
  tab: { key: Exclude<TabKey, 'scan'>; label: string; icon: string };
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}>
      <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
      <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  shell: {
    width: '100%',
    maxWidth: layout.maxPhoneWidth - 24,
    height: layout.tabHeight,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.94)',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    ...shadows.tab,
  },
  sideGroup: {
    flex: 1,
    flexDirection: 'row-reverse',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  tab: {
    minWidth: 56,
    height: 58,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabActive: {
    backgroundColor: colors.primarySoft,
  },
  icon: {
    fontFamily: typography.fontFamily,
    fontSize: 20,
    fontWeight: '900',
    color: colors.tabInactive,
    lineHeight: 22,
  },
  iconActive: {
    color: colors.primaryDeep,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.tabInactive,
  },
  labelActive: {
    color: colors.primaryDeep,
  },
  scanWrap: {
    width: 82,
    height: 102,
    marginTop: -34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanGlow: {
    position: 'absolute',
    top: 7,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,167,200,0.18)',
  },
  scanButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    borderWidth: 7,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  scanButtonActive: {
    backgroundColor: colors.primaryDark,
  },
  scanIcon: {
    color: colors.white,
    fontSize: 34,
    fontWeight: '900',
    marginTop: -2,
  },
  scanLabel: {
    marginTop: 4,
    fontFamily: typography.fontFamily,
    color: colors.primaryDeep,
    fontSize: 11.5,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
});
