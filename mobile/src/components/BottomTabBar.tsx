import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NavigationProp } from '@react-navigation/native';
import { colors, radius, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type TabKey = 'home' | 'pools' | 'scan' | 'history' | 'settings';

interface Props {
  active: TabKey;
  navigation: NavigationProp<RootStackParamList>;
}

const TABS: { key: TabKey; label: string; glyph: string }[] = [
  { key: 'settings', label: 'הגדרות', glyph: '⚙︎' },
  { key: 'history', label: 'היסטוריה', glyph: '◷' },
  { key: 'scan', label: 'סריקה', glyph: '⌖' },
  { key: 'pools', label: 'בריכות', glyph: '≈' },
  { key: 'home', label: 'בית', glyph: '⌂' },
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
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.barGlow} />
      <View style={styles.bar}>
        {TABS.map((tab) => {
          if (tab.key === 'scan') {
            return (
              <Pressable key={tab.key} onPress={() => go(tab.key)} style={({ pressed }) => [styles.scanTab, pressed && styles.pressed]}>
                <View style={[styles.scanHalo, active === 'scan' && styles.scanHaloActive]}>
                  <View style={styles.scanCircle}>
                    <Text style={styles.scanGlyph}>{tab.glyph}</Text>
                  </View>
                </View>
                <Text style={styles.scanLabel}>{tab.label}</Text>
              </Pressable>
            );
          }

          const isActive = active === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => go(tab.key)} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
              <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                <Text style={[styles.glyph, isActive && styles.glyphActive]}>{tab.glyph}</Text>
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  barGlow: {
    position: 'absolute',
    left: 32,
    right: 32,
    bottom: 24,
    height: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(6,168,199,0.18)',
  },
  bar: {
    minHeight: 78,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xxl,
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 11,
    paddingBottom: 9,
    borderWidth: 1,
    borderColor: 'rgba(215,234,241,0.85)',
    ...shadows.tab,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 58,
    paddingVertical: 4,
    gap: 3,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconWrapActive: {
    backgroundColor: colors.primarySoft,
  },
  glyph: {
    fontSize: 22,
    color: colors.tabInactive,
    fontFamily: typography.fontFamily,
    fontWeight: '900',
  },
  glyphActive: { color: colors.primaryDark },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.tabInactive,
    fontFamily: typography.fontFamily,
  },
  labelActive: { color: colors.primaryDark },
  scanTab: {
    alignItems: 'center',
    width: 68,
    marginTop: -34,
    gap: 5,
  },
  scanHalo: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 6,
    borderColor: 'rgba(255,255,255,0.98)',
    ...shadows.button,
  },
  scanHaloActive: {
    backgroundColor: '#C7F5FC',
  },
  scanCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  scanGlyph: { color: colors.white, fontSize: 30, fontWeight: '900' },
  scanLabel: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: typography.fontFamily,
  },
});