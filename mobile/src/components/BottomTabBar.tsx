import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import type { NavigationProp } from '@react-navigation/native';
import { colors, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type TabKey = 'home' | 'pools' | 'scan' | 'history' | 'settings';

interface Props {
  active: TabKey;
  navigation: NavigationProp<RootStackParamList>;
}

export function BottomTabBar({ active, navigation }: Props) {
  function go(tab: TabKey) {
    if (tab === 'home') navigation.navigate('Dashboard');
    else if (tab === 'pools') navigation.navigate('PoolsList');
    else if (tab === 'scan') navigation.navigate('SelectStrip');
    // history / settings — not yet wired
  }

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.bar}>
        <Tab label="הגדרות" icon={<IconSettings active={active === 'settings'} />} active={active === 'settings'} onPress={() => go('settings')} />
        <Tab label="היסטוריה" icon={<IconHistory active={active === 'history'} />} active={active === 'history'} onPress={() => go('history')} />
        <ScanTab active={active === 'scan'} onPress={() => go('scan')} />
        <Tab label="בריכות" icon={<IconPools active={active === 'pools'} />} active={active === 'pools'} onPress={() => go('pools')} />
        <Tab label="בית" icon={<IconHome active={active === 'home'} />} active={active === 'home'} onPress={() => go('home')} />
      </View>
    </View>
  );
}

function Tab({ label, icon, active, onPress }: { label: string; icon: React.ReactNode; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tab}>
      <View style={[styles.iconWrap, active && styles.iconWrapActive]}>{icon}</View>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

function ScanTab({ active, onPress }: { active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.scanTab}>
      <View style={[styles.scanCircle, active && styles.scanCircleActive]}>
        <IconScan />
      </View>
      <Text style={[styles.label, styles.scanLabel]}>סריקה</Text>
    </Pressable>
  );
}

const ICON = colors.muted;
const ICON_ACTIVE = colors.primary;

function IconHome({ active }: { active: boolean }) {
  const c = active ? ICON_ACTIVE : ICON;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2v-9z" stroke={c} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
function IconPools({ active }: { active: boolean }) {
  const c = active ? ICON_ACTIVE : ICON;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 14c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1M3 18c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1" stroke={c} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconHistory({ active }: { active: boolean }) {
  const c = active ? ICON_ACTIVE : ICON;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={c} strokeWidth={2} />
      <Path d="M12 7v5l3 2" stroke={c} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconSettings({ active }: { active: boolean }) {
  const c = active ? ICON_ACTIVE : ICON;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={c} strokeWidth={2} />
      <Path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2l-.4-2.6h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" stroke={c} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
function IconScan() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M3 12h18" stroke={colors.white} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  bar: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 28,
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  tab: { alignItems: 'center', width: 56, paddingVertical: 4, gap: 2 },
  iconWrap: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: colors.primarySoft },
  label: { fontSize: 10, fontWeight: '800', color: colors.muted, fontFamily: typography.fontFamily },
  labelActive: { color: colors.primary },
  scanTab: { alignItems: 'center', width: 64, marginTop: -28, gap: 4 },
  scanCircle: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary,
    ...shadows.button,
  },
  scanCircleActive: { borderWidth: 4, borderColor: colors.primarySoft },
  scanLabel: { color: colors.primary },
});
