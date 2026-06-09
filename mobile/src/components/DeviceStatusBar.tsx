import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme';

export function DeviceStatusBar({ light = false }: { light?: boolean }) {
  const color = light ? colors.white : '#071F2A';

  return (
    <View style={styles.bar}>
      <Text style={[styles.time, { color }]}>9:41</Text>
      <View style={[styles.island, { backgroundColor: light ? '#071F2A' : '#070D12' }]} />
      <View style={styles.indicators}>
        <View style={styles.signal}>
          <View style={[styles.signalBar, { height: 5, backgroundColor: color }]} />
          <View style={[styles.signalBar, { height: 7, backgroundColor: color }]} />
          <View style={[styles.signalBar, { height: 9, backgroundColor: color }]} />
        </View>
        <View style={styles.wifiMark}>
          <View style={[styles.wifiArcLarge, { borderColor: color }]} />
          <View style={[styles.wifiArcSmall, { borderColor: color }]} />
          <View style={[styles.wifiDot, { backgroundColor: color }]} />
        </View>
        <View style={[styles.battery, { borderColor: color }]}>
          <View style={[styles.batteryFill, { backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  time: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '800',
  },
  island: {
    position: 'absolute',
    top: 7,
    left: '50%',
    width: 86,
    height: 24,
    marginLeft: -43,
    borderRadius: 14,
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signal: {
    height: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  signalBar: {
    width: 3,
    borderRadius: 2,
  },
  wifiMark: {
    width: 14,
    height: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  wifiArcLarge: {
    position: 'absolute',
    top: 1,
    width: 14,
    height: 8,
    borderTopWidth: 1.4,
    borderLeftWidth: 1.4,
    borderRightWidth: 1.4,
    borderBottomWidth: 0,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  wifiArcSmall: {
    position: 'absolute',
    top: 5,
    width: 8,
    height: 5,
    borderTopWidth: 1.4,
    borderLeftWidth: 1.4,
    borderRightWidth: 1.4,
    borderBottomWidth: 0,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  wifiDot: {
    width: 2.6,
    height: 2.6,
    borderRadius: 2,
  },
  battery: {
    width: 20,
    height: 10,
    borderRadius: 3,
    borderWidth: 1.4,
    padding: 1,
  },
  batteryFill: {
    flex: 1,
    borderRadius: 2,
  },
});
