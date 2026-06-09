import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { LineIcon } from '../components/LineIcon';
import { WaterTexture } from '../components/WaterVisuals';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

export function ScanScreen({ navigation }: Props) {
  return (
    <AppShell activeTab="scan" navigation={navigation} scroll={false} waterMode="full">
      <View style={styles.screen}>
        <View style={styles.waterLayer}>
          <WaterTexture deep />
        </View>
        <View style={styles.topBar}>
          <View style={styles.actions}>
            <Pressable style={styles.toolButton}>
              <LineIcon name="help" color={colors.white} size={20} />
            </Pressable>
          </View>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>סריקת סטיק</Text>
            <Text style={styles.subtitle}>מקם את הסטיק בתוך המסגרת</Text>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.toolButton}>
              <LineIcon name="flash" color={colors.white} size={20} />
            </Pressable>
          </View>
        </View>

        <View style={styles.scanArea}>
          <Pressable onPress={() => navigation.navigate('Results')} style={styles.frame}>
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <MockStrip />
            <View style={styles.hand}>
              <View style={styles.thumb} />
              <View style={styles.finger} />
            </View>
          </Pressable>
        </View>

        <View style={styles.bottomArea}>
          <View style={styles.instructionPill}>
            <Text style={styles.instruction}>החזק את המצלמה יציבה ובאור טבעי</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('Results')} style={({ pressed }) => [styles.resultsButton, pressed && styles.pressed]}>
            <LineIcon name="results" color={colors.white} size={16} />
            <Text style={styles.resultsButtonText}>המשך לתוצאות</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Home')} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <LineIcon name="close" color={colors.text} size={24} />
          </Pressable>
        </View>
      </View>
    </AppShell>
  );
}

function MockStrip() {
  const pads = ['#F3C45C', '#D8728F', '#72C9BD', '#6B8BD8', '#BFD85E'];

  return (
    <View style={styles.strip}>
      {pads.map((pad) => (
        <View key={pad} style={[styles.pad, { backgroundColor: pad }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 120,
  },
  waterLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: colors.white,
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    marginTop: 5,
    color: 'rgba(255,255,255,0.86)',
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '800',
    ...rtl.textCenter,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  toolButton: {
    width: 34,
    height: 34,
    borderRadius: 18,
    backgroundColor: 'rgba(0,48,65,0.14)',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  scanArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  frame: {
    width: '82%',
    maxWidth: 300,
    aspectRatio: 1,
    borderRadius: radius.xxl,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderColor: colors.white,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: radius.xl,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: radius.xl,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: radius.xl,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: radius.xl,
  },
  strip: {
    width: 38,
    height: 240,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 10,
    ...shadows.card,
  },
  pad: {
    width: 26,
    height: 25,
    borderRadius: 4,
  },
  hand: {
    position: 'absolute',
    bottom: -84,
    left: 95,
    width: 92,
    height: 118,
    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    backgroundColor: '#F1C4A8',
    transform: [{ rotate: '-9deg' }],
  },
  thumb: {
    position: 'absolute',
    top: 18,
    right: -18,
    width: 36,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#E8B08F',
    transform: [{ rotate: '-24deg' }],
  },
  finger: {
    position: 'absolute',
    top: -36,
    left: 34,
    width: 31,
    height: 82,
    borderRadius: 18,
    backgroundColor: '#F8D0B7',
  },
  bottomArea: {
    alignItems: 'center',
    gap: spacing.md,
  },
  instructionPill: {
    borderRadius: radius.round,
    backgroundColor: 'rgba(4,44,57,0.62)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    ...shadows.soft,
  },
  instruction: {
    color: colors.white,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  resultsButton: {
    minHeight: 42,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    ...shadows.button,
  },
  resultsButtonText: {
    color: colors.white,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
