import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NavigationProp } from '@react-navigation/native';
import { colors, layout, radius, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type TabKey = 'home' | 'pools' | 'scan' | 'history' | 'settings';

interface Props {
  active: TabKey;
  navigation: NavigationProp<RootStackParamList>;
}

const LEFT_TABS: { key: Exclude<TabKey, 'scan'>; label: string; icon: string }[] = [
  { key: 'settings', label: 'הגדרות', icon: '⚙' },
  { key: 'history', label: 'היסטוריה', icon: '◷' },
];

const RIGHT_TABS: { key: Exclude<TabKey, 'scan'>; label: string; icon: string }[] = [
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
        <View style={styles.tabGroup}>
          {LEFT_TABS.map((tab) => (
            <TabItem key={tab.key} tab={tab} active={active === tab.key} onPress={() => go(tab.key)} />
          ))}
        </View>

        <Pressable onPress={() => go('scan')} style={({ pressed }) => [styles.scanWrap, pressed && styles.pressed]}>
          <View style={styles.scanHalo} />
          <View style={[styles.scanButton, active === 'scan' && styles.scanButtonActive]}>
            <Text style={styles.scanIcon}>▣</Text>
          </View>
          <Text style={styles.scanLabel}>סריקה</Text>
        </Pressable>

        <View style={styles.tabGroup}>
          {RIGHT_TABS.map((tab) => (
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
      <View style={[styles.iconBubble, active && styles.iconBubbleActive]}>
        <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
      </View>
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
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  shell: {
    width: '100%',
    maxWidth: layout.maxPhoneWidth - 32,
    height: layout.tabHeight,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(210,236,244,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    ...shadows.tab,
  },
  tabGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  tab: {
    minWidth: 54,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabActive: {
    backgroundColor: 'transparent',
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleActive: {
    backgroundColor: colors.primarySoft,
  },
  icon: {
    fontFamily: typography.fontFamily,
    fontSize: 19,
    fontWeight: '900',
    color: colors.tabInactive,
    lineHeight: 21,
  },
  iconActive: {
    color: colors.primary,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    color: colors.tabInactive,
  },
  labelActive: {
    color: colors.primaryDeep,
  },
  scanWrap: {
    width: 84,
    height: 104,
    marginTop: -34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanHalo: {
    position: 'absolute',
    top: 5,
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(6,168,205,0.14)',
  },
  scanButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primary,
    borderWidth: 6,
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
    fontSize: 28,
    fontWeight: '900',
    marginTop: -1,
  },
  scanLabel: {
    marginTop: 3,
    fontFamily: typography.fontFamily,
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
});
