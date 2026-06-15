import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { layout } from '../theme';

export function WebPhoneFrame({ children }: { children: ReactNode }) {
  const viewport = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  const scale = Math.min(1, (viewport.width - 28) / layout.maxPhoneWidth, (viewport.height - 28) / layout.maxPhoneHeight);

  return (
    <View style={styles.viewport}>
      <View
        style={[
          styles.deviceFrame,
          {
            width: layout.maxPhoneWidth * scale,
            height: layout.maxPhoneHeight * scale,
            borderRadius: 42 * scale,
            borderWidth: 4 * scale,
          },
        ]}
      >
        <View
          style={[
            styles.phone,
            {
              width: layout.maxPhoneWidth,
              height: layout.maxPhoneHeight,
              transform: [{ scale }],
              transformOrigin: 'top left',
            } as object,
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF8FB',
    padding: 14,
    overflow: 'hidden',
  },
  deviceFrame: {
    position: 'relative',
    backgroundColor: '#080D11',
    borderColor: '#111820',
    overflow: 'hidden',
    shadowColor: '#0B2730',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 10,
  },
  phone: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 36,
    overflow: 'hidden',
  },
});
