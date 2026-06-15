import { View, StyleSheet } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

export type LineIconName =
  | 'home'
  | 'pools'
  | 'scan'
  | 'results'
  | 'history'
  | 'settings'
  | 'bell'
  | 'menu'
  | 'plus'
  | 'filter'
  | 'help'
  | 'flash'
  | 'camera'
  | 'image'
  | 'user'
  | 'close'
  | 'check'
  | 'drop'
  | 'more'
  | 'chevronLeft';

type IconSource = 'feather' | 'ionicons' | 'material';

const iconMap: Record<LineIconName, { source: IconSource; name: string }> = {
  home: { source: 'feather', name: 'home' },
  pools: { source: 'material', name: 'pool' },
  scan: { source: 'ionicons', name: 'scan-outline' },
  results: { source: 'ionicons', name: 'stats-chart-outline' },
  history: { source: 'feather', name: 'clock' },
  settings: { source: 'feather', name: 'settings' },
  bell: { source: 'feather', name: 'bell' },
  menu: { source: 'feather', name: 'menu' },
  plus: { source: 'feather', name: 'plus' },
  filter: { source: 'feather', name: 'sliders' },
  help: { source: 'feather', name: 'help-circle' },
  flash: { source: 'ionicons', name: 'flash-outline' },
  camera: { source: 'feather', name: 'camera' },
  image: { source: 'feather', name: 'image' },
  user: { source: 'feather', name: 'user' },
  close: { source: 'feather', name: 'x' },
  check: { source: 'feather', name: 'check' },
  drop: { source: 'ionicons', name: 'water-outline' },
  more: { source: 'feather', name: 'more-horizontal' },
  chevronLeft: { source: 'feather', name: 'chevron-left' },
};

interface LineIconProps {
  name: LineIconName;
  color?: string;
  size?: number;
}

export function LineIcon({ name, color = colors.primaryDark, size = 20 }: LineIconProps) {
  const icon = iconMap[name];

  return (
    <View style={[styles.wrap, { width: size + 8, height: size + 8 }]}>
      {icon.source === 'feather' ? (
        <Feather name={icon.name as never} color={color} size={size} strokeWidth={2.2} />
      ) : icon.source === 'ionicons' ? (
        <Ionicons name={icon.name as never} color={color} size={size} />
      ) : (
        <MaterialCommunityIcons name={icon.name as never} color={color} size={size} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
