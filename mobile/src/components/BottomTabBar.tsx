import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NavigationProp } from '@react-navigation/native';
import { colors, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type TabKey = 'home' | 'pools' | 'scan' | 'history' | 'settings';

interface Props {
  active: TabKey;
  navigation: NavigationProp<RootStackParamList>;
}

const TABS: { key: TabKey; label: string; glyph: string }[] = [
  { key: 'settings', label: 'הגדרות', glyph: '⚙' },
  { key: 'history', label: 'היסטוריה', glyph: '⏱' },
  { key: 'scan', label: 'סריקה', glyph: '⌗' },
  { key: 'pools', label: 'בריכות', glyph: '~' },
  { key: 'home', label: 'בית', glyph: '⌂' },
];

export function BottomTabBar({ active, navigation }: Props) {
  function go(tab: TabKey) {
    if (tab === 'home') navigation.navigate('Dashboard');
    else if (tab === 'pools') navigation.navigate('PoolsList');
    else if (tab === 'scan') navigation.navigate('SelectStrip');
  }

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.bar}>
        {TABS.map((t) => {
          if (t.key === 'scan') {
            return (
              <Pressable key={t.key} onPress={() => go(t.key)} style={styles.scanTab}>
                <View style={[styles.scanCircle, active === 'scan' && styles.scanCircleActive]}>
                  <Text style={styles.scanGlyph}>{t.glyph}</Text>
                </View>
                <Text style={[styles.label, styles.scanLabel]}>{t.label}</Text>
              </Pressable>
            );
          }
          const isActive = active === t.key;
          return (
            <Pressable key={t.key} onPress={() => go(t.key)} style={styles.tab}>
              <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                <Text style={[styles.glyph, isActive && styles.glyphActive]}>{t.glyph}</Text>
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingBottom: 18 },
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
  glyph: { fontSize: 20, color: colors.muted, fontFamily: typography.fontFamily },
  glyphActive: { color: colors.primary },
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
  scanGlyph: { color: colors.white, fontSize: 28, fontWeight: '900' },
  scanLabel: { color: colors.primary },
});
