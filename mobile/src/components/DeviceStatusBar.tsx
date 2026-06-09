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
        <Text style={[styles.wifi, { color }]}>⌁</Text>
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
  wifi: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    fontWeight: '900',
    marginTop: -2,
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
