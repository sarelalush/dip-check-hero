import type { ReactNode } from 'react';
import { ImageBackground, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NavigationProp } from '@react-navigation/native';
import { BottomTabBar, type TabKey } from './BottomTabBar';
import { DeviceStatusBar } from './DeviceStatusBar';
import { WebPhoneFrame } from './WebPhoneFrame';
import { colors, layout } from '../theme';
import type { RootStackParamList } from '../../App';

const APP_POOL_IMAGE = require('../../assets/images/home-pool.png');

interface AppShellProps {
  activeTab: TabKey;
  children: ReactNode;
  navigation: NavigationProp<RootStackParamList>;
  scroll?: boolean;
  showBottomTabs?: boolean;
  waterMode?: 'soft' | 'full';
  contentStyle?: StyleProp<ViewStyle>;
}

export function AppShell({
  activeTab,
  children,
  navigation,
  scroll = true,
  showBottomTabs = true,
  waterMode = 'soft',
  contentStyle,
}: AppShellProps) {
  const showDevicePreview = Platform.OS === 'web';
  const insets = useSafeAreaInsets();
  const bottomInset = showDevicePreview ? 0 : Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 16);
  const topContentPadding = showDevicePreview ? 12 : Math.max(insets.top + 12, Platform.OS === 'android' ? 38 : 32);
  const contentBottomPadding = (showBottomTabs ? layout.tabHeight : 0) + bottomInset + 26;
  const content = (
    <SafeAreaView style={[styles.safe, contentStyle, { paddingTop: topContentPadding, paddingBottom: contentBottomPadding }]} edges={[]}>
      {children}
    </SafeAreaView>
  );

  const phone = (
    <View style={[styles.phone, !showDevicePreview && styles.nativePhone, waterMode === 'full' && styles.phoneFull]}>
      <WaterBackdrop full={waterMode === 'full'} />
      {showDevicePreview ? <DeviceStatusBar light={waterMode === 'full'} /> : null}
      {scroll ? (
        <SafeAreaView style={styles.safeScroll} edges={[]}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              contentStyle,
              { paddingTop: topContentPadding, paddingBottom: contentBottomPadding },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      ) : (
        content
      )}
      {showBottomTabs ? <BottomTabBar active={activeTab} navigation={navigation} /> : null}
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
      <ImageBackground source={APP_POOL_IMAGE} resizeMode="cover" style={[styles.topWaterImage, full && styles.fullWaterImage]}>
        <View style={[styles.topWaterTint, full && styles.fullWaterTint]} />
      </ImageBackground>
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
  },
  safeScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 2,
  },
  topWaterImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  fullWaterImage: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: undefined,
  },
  topWaterTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,253,255,0.72)',
  },
  fullWaterTint: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
});
