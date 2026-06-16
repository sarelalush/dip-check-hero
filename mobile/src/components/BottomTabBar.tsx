import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NavigationProp } from '@react-navigation/native';
import { colors, layout, radius, rtl, shadows, typography } from '../theme';
import { LineIcon, type LineIconName } from './LineIcon';
import type { RootStackParamList } from '../../App';
import { useStartScanFlow } from '../hooks/useStartScanFlow';

export type TabKey = 'home' | 'pools' | 'scan' | 'results' | 'history' | 'settings';

interface Props {
  active: TabKey;
  navigation: NavigationProp<RootStackParamList>;
}

const leftTabs: { key: Extract<TabKey, 'settings' | 'history'>; label: string; icon: LineIconName }[] = [
  { key: 'settings', label: 'הגדרות', icon: 'settings' },
  { key: 'history', label: 'היסטוריה', icon: 'history' },
];

const rightTabs: { key: Extract<TabKey, 'pools' | 'home'>; label: string; icon: LineIconName }[] = [
  { key: 'pools', label: 'בריכות', icon: 'pools' },
  { key: 'home', label: 'בית', icon: 'home' },
];

export function BottomTabBar({ active, navigation }: Props) {
  const startScanFlow = useStartScanFlow(navigation);

  function go(tab: TabKey) {
    if (tab === 'home') navigation.navigate('Home');
    else if (tab === 'pools') navigation.navigate('Pools');
    else if (tab === 'scan') startScanFlow();
    else if (tab === 'results') navigation.navigate('Results');
    else if (tab === 'history') navigation.navigate('History');
    else navigation.navigate('Settings');
  }

  return (
    <View pointerEvents="box-none" style={styles.safeArea}>
      <View style={styles.shell}>
        <View style={styles.group}>
          {leftTabs.map((tab) => (
            <TabItem key={tab.key} active={active === tab.key} label={tab.label} icon={tab.icon} onPress={() => go(tab.key)} />
          ))}
        </View>

        <Pressable onPress={() => go('scan')} style={({ pressed }) => [styles.scanWrap, pressed && styles.pressed]}>
          <View style={styles.scanHalo} />
          <View style={[styles.scanButton, active === 'scan' && styles.scanButtonActive]}>
            <LineIcon name="scan" color={colors.white} size={25} />
          </View>
          <Text style={styles.scanLabel}>סריקה</Text>
        </Pressable>

        <View style={styles.group}>
          {rightTabs.map((tab) => (
            <TabItem key={tab.key} active={active === tab.key} label={tab.label} icon={tab.icon} onPress={() => go(tab.key)} />
          ))}
        </View>
      </View>
    </View>
  );
}

function TabItem({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: LineIconName;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
      <View style={[styles.iconBubble, active && styles.iconBubbleActive]}>
        <LineIcon name={icon} color={active ? colors.primary : colors.tabInactive} size={18} />
      </View>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
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
    paddingBottom: layout.tabBottom + 2,
  },
  shell: {
    width: '100%',
    maxWidth: layout.maxPhoneWidth - 24,
    height: layout.tabHeight,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 7,
    ...shadows.tab,
  },
  group: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  tab: {
    width: 51,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconBubble: {
    width: 25,
    height: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleActive: {
    backgroundColor: colors.primarySoft,
  },
  label: {
    color: colors.tabInactive,
    fontFamily: typography.fontFamilyMedium,
    fontSize: 9,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  labelActive: {
    color: colors.primaryDark,
  },
  scanWrap: {
    width: 70,
    height: 88,
    marginTop: -30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanHalo: {
    position: 'absolute',
    top: 8,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(8,175,203,0.16)',
  },
  scanButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    borderWidth: 5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  scanButtonActive: {
    backgroundColor: colors.primaryDark,
  },
  scanLabel: {
    marginTop: 1,
    color: colors.primaryDark,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 10,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
});
