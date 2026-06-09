import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

export function WaterTexture({ deep = false }: { deep?: boolean }) {
  return (
    <View style={[styles.water, deep && styles.deepWater]}>
      <View style={[styles.caustic, styles.causticOne]} />
      <View style={[styles.caustic, styles.causticTwo]} />
      <View style={[styles.caustic, styles.causticThree]} />
      <View style={[styles.caustic, styles.causticFour]} />
      <View style={[styles.softBand, styles.bandOne]} />
      <View style={[styles.softBand, styles.bandTwo]} />
      <View style={[styles.softBand, styles.bandThree]} />
    </View>
  );
}

export function PoolPhoto({ variant = 'villa' }: { variant?: 'villa' | 'city' | 'home' }) {
  return (
    <View style={styles.photo}>
      <View style={styles.sky} />
      <View style={[styles.sunGlow, variant === 'city' && styles.citySun]} />
      <View style={[styles.house, variant === 'city' && styles.cityBlock]} />
      <View style={[styles.houseSmall, variant === 'city' && styles.cityBlockTwo]} />
      <View style={styles.trees}>
        <View style={styles.tree} />
        <View style={styles.tree} />
        <View style={styles.tree} />
      </View>
      <View style={styles.poolWater}>
        <WaterTexture />
      </View>
      <View style={styles.deck} />
      {variant === 'home' ? (
        <>
          <View style={styles.lounger} />
          <View style={styles.palm} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  water: {
    flex: 1,
    backgroundColor: colors.waterDeep,
    overflow: 'hidden',
  },
  deepWater: {
    backgroundColor: '#0787A5',
  },
  caustic: {
    position: 'absolute',
    borderColor: 'rgba(255,255,255,0.24)',
    borderWidth: 2,
    transform: [{ rotate: '-18deg' }],
  },
  causticOne: {
    top: -24,
    right: 18,
    width: 210,
    height: 126,
    borderRadius: 96,
  },
  causticTwo: {
    top: 70,
    left: -38,
    width: 220,
    height: 112,
    borderRadius: 84,
  },
  causticThree: {
    bottom: -18,
    right: -36,
    width: 230,
    height: 124,
    borderRadius: 92,
  },
  causticFour: {
    top: 168,
    right: 80,
    width: 160,
    height: 78,
    borderRadius: 64,
  },
  softBand: {
    position: 'absolute',
    height: 9,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.22)',
    transform: [{ rotate: '-8deg' }],
  },
  bandOne: {
    top: 48,
    left: 34,
    width: 150,
  },
  bandTwo: {
    top: 120,
    right: 28,
    width: 180,
  },
  bandThree: {
    bottom: 58,
    left: 68,
    width: 126,
  },
  photo: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#C9EEF8',
  },
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: '#D9F3FF',
  },
  sunGlow: {
    position: 'absolute',
    top: 26,
    right: 32,
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.68)',
  },
  citySun: {
    right: 220,
  },
  house: {
    position: 'absolute',
    top: 42,
    right: 28,
    width: 136,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F8FAF8',
    borderWidth: 1,
    borderColor: 'rgba(42,86,96,0.1)',
  },
  houseSmall: {
    position: 'absolute',
    top: 64,
    right: 138,
    width: 86,
    height: 34,
    borderRadius: 7,
    backgroundColor: '#C7D3CC',
  },
  cityBlock: {
    top: 34,
    right: 48,
    width: 56,
    height: 78,
    backgroundColor: '#A8BAC2',
  },
  cityBlockTwo: {
    top: 54,
    right: 112,
    width: 156,
    height: 58,
    backgroundColor: '#C0CDD2',
  },
  trees: {
    position: 'absolute',
    top: 84,
    left: 0,
    right: 0,
    height: 34,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  tree: {
    width: 44,
    height: 34,
    borderRadius: 18,
    backgroundColor: '#5BA66B',
  },
  poolWater: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 20,
    height: '48%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.86)',
  },
  deck: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 28,
    backgroundColor: '#E9E0D2',
  },
  lounger: {
    position: 'absolute',
    right: 56,
    top: 84,
    width: 68,
    height: 8,
    borderRadius: 8,
    backgroundColor: '#C08C66',
    transform: [{ rotate: '-12deg' }],
  },
  palm: {
    position: 'absolute',
    right: 36,
    top: 48,
    width: 28,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(75,151,86,0.72)',
    transform: [{ rotate: '-18deg' }],
  },
});
