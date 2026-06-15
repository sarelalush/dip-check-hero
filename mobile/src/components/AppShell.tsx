import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NavigationProp } from '@react-navigation/native';
import { BottomTabBar, type TabKey } from './BottomTabBar';
import { DeviceStatusBar } from './DeviceStatusBar';
import { WebPhoneFrame } from './WebPhoneFrame';
import { colors, layout } from '../theme';
import type { RootStackParamList } from '../../App';

interface AppShellProps {
  activeTab: TabKey;
  children: ReactNode;
  navigation: NavigationProp<RootStackParamList>;
  scroll?: boolean;
  waterMode?: 'soft' | 'full';
  contentStyle?: StyleProp<ViewStyle>;
}

export function AppShell({
  activeTab,
  children,
  navigation,
  scroll = true,
  waterMode = 'soft',
  contentStyle,
}: AppShellProps) {
  const showDevicePreview = Platform.OS === 'web';
  const content = (
    <SafeAreaView style={[styles.safe, contentStyle]} edges={['top']}>
      {children}
    </SafeAreaView>
  );

  const phone = (
    <View style={[styles.phone, !showDevicePreview && styles.nativePhone, waterMode === 'full' && styles.phoneFull]}>
      <WaterBackdrop full={waterMode === 'full'} />
      {showDevicePreview ? <DeviceStatusBar light={waterMode === 'full'} /> : null}
      {scroll ? (
        <SafeAreaView style={styles.safeScroll} edges={[]}>
          <ScrollView contentContainerStyle={[styles.scrollContent, contentStyle]} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </SafeAreaView>
      ) : (
        content
      )}
      <BottomTabBar active={activeTab} navigation={navigation} />
    </View>
  );

  if (!showDevicePreview) {
    return phone;
  }

  return <WebPhoneFrame>{phone}</WebPhoneFrame>;
}

function WaterBackdrop({ full }: { full: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <View style={[styles.topWater, full && styles.fullWater]} />
      <View style={styles.waveOne} />
      <View style={styles.waveTwo} />
      <View style={styles.waveThree} />
      <View style={styles.softGlow} />
    </View>
  );
}

const styles = StyleSheet.create({
  phone: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 36,
    overflow: 'hidden',
  },
  nativePhone: {
    borderRadius: 0,
  },
  phoneFull: {
    backgroundColor: colors.water,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: layout.tabHeight + 26,
  },
  safeScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: layout.tabHeight + 26,
  },
  topWater: {
    position: 'absolute',
    top: -40,
    left: -30,
    right: -30,
    height: 236,
    borderBottomLeftRadius: 42,
    borderBottomRightRadius: 42,
    backgroundColor: '#E7F8FC',
  },
  fullWater: {
    height: '100%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#BDEFF7',
  },
  waveOne: {
    position: 'absolute',
    top: 68,
    right: -72,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  waveTwo: {
    position: 'absolute',
    top: 142,
    left: -96,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(102,210,229,0.24)',
  },
  waveThree: {
    position: 'absolute',
    bottom: 78,
    right: -120,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  softGlow: {
    position: 'absolute',
    bottom: -90,
    left: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(8,175,203,0.12)',
  },
});
