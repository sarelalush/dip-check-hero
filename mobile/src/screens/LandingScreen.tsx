import { ImageBackground, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LineIcon, type LineIconName } from '../components/LineIcon';
import { colors, radius, rtl, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const welcomePool = require('../assets/welcome-pool.png');

const padColors = ['#A979C9', '#E9778E', '#F39974', '#F5C849', '#E9DA77', '#B8CB65', '#6FC6B4', '#62B9E3'];

const features: Array<{ icon: LineIconName; label: string }> = [
  { icon: 'scan', label: 'צילום סטיק' },
  { icon: 'flash', label: 'תוצאה מיידית' },
  { icon: 'results', label: 'המלצות מדויקות' },
];

export function LandingScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <ImageBackground source={welcomePool} resizeMode="cover" style={styles.background} imageStyle={styles.backgroundImage}>
        <View pointerEvents="none" style={styles.skyWash} />
        <View pointerEvents="none" style={styles.bottomMist} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.brandBlock}>
            <View style={styles.brandRow}>
              <Text style={styles.brandDip}>Dip</Text>
              <Text style={styles.brandCheck}>Check</Text>
              <View style={styles.dropLogo}>
                <LineIcon name="check" color={colors.white} size={22} />
              </View>
            </View>
            <Text style={styles.brandSub}>בדיקת מים חכמה</Text>
          </View>

          <View style={styles.heroStage}>
            <TestStrip />
            <View style={styles.copyBlock}>
              <Text style={styles.heroTitle}>איזון מים{'\n'}בלי ניחושים</Text>
              <Text style={styles.heroSubtitle}>צלם סטיק בדיקה וקבל{'\n'}תוצאה ברורה תוך שניות</Text>
            </View>
          </View>

          <View style={styles.actionPanel}>
            <Pressable onPress={() => navigation.navigate('Signup')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <View style={styles.primaryIcon}>
                <LineIcon name="camera" color={colors.white} size={25} />
              </View>
              <Text style={styles.primaryLabel}>התחל בדיקה</Text>
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Login')} style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]}>
              <View style={styles.loginIcon}>
                <LineIcon name="user" color={colors.primaryDeep} size={24} />
              </View>
              <Text style={styles.loginLabel}>יש לי חשבון</Text>
            </Pressable>

            <View style={styles.featureRow}>
              {features.map((feature) => (
                <View key={feature.label} style={styles.featureCard}>
                  <View style={styles.featureIcon}>
                    <LineIcon name={feature.icon} color={colors.primaryDark} size={32} />
                  </View>
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.chevrons}>
              <View style={styles.chevron} />
              <View style={[styles.chevron, styles.chevronSecond]} />
            </View>
          </View>
        </ScrollView>

        <View style={styles.fakeTabBar}>
          <LineIcon name="user" color="#C3D2DA" size={23} />
          <LineIcon name="history" color="#C3D2DA" size={23} />
          <View style={styles.fakeCenter}>
            <LineIcon name="drop" color={colors.white} size={26} />
          </View>
          <LineIcon name="results" color="#C3D2DA" size={24} />
          <LineIcon name="home" color={colors.primary} size={26} />
        </View>
      </ImageBackground>
    </View>
  );
}

function TestStrip() {
  return (
    <View style={styles.stripScene}>
      <View style={styles.glass} />
      <View style={styles.strip}>
        {padColors.map((color) => (
          <View key={color} style={[styles.pad, { backgroundColor: color }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  background: { flex: 1 },
  backgroundImage: { width: '100%', height: '100%' },
  skyWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 178, backgroundColor: 'rgba(240,250,255,0.14)' },
  bottomMist: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 390, backgroundColor: 'rgba(255,255,255,0.62)' },
  content: { minHeight: 820, paddingHorizontal: 20, paddingTop: 48, paddingBottom: 118 },
  brandBlock: { alignItems: 'flex-end', paddingRight: 22 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  brandDip: { color: '#0A3D78', fontFamily: typography.fontFamilyExtraBold, fontSize: 41, fontWeight: '900', letterSpacing: 0 },
  brandCheck: { color: colors.primary, fontFamily: typography.fontFamilyExtraBold, fontSize: 41, fontWeight: '900', letterSpacing: 0 },
  brandSub: { marginTop: -5, marginRight: 86, color: '#133F72', fontFamily: typography.fontFamilyBold, fontSize: 18, fontWeight: '900', ...rtl.text },
  dropLogo: {
    marginLeft: 11,
    width: 57,
    height: 68,
    borderRadius: 31,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    backgroundColor: 'rgba(8,175,203,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    borderWidth: 4,
    borderColor: 'rgba(125,221,236,0.9)',
  },
  heroStage: { flex: 1, minHeight: 412, marginTop: 42, justifyContent: 'flex-end' },
  copyBlock: { alignItems: 'flex-end', marginBottom: 26 },
  heroTitle: {
    color: '#073B73',
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 54,
    fontWeight: '900',
    lineHeight: 63,
    ...rtl.text,
  },
  heroSubtitle: {
    marginTop: 15,
    color: '#0B3F72',
    fontFamily: typography.fontFamilyRegular,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 38,
    ...rtl.text,
  },
  stripScene: { position: 'absolute', left: 34, bottom: 22, width: 132, height: 370 },
  glass: {
    position: 'absolute',
    left: -28,
    bottom: -18,
    width: 128,
    height: 96,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.82)',
    backgroundColor: 'rgba(207,246,252,0.45)',
    transform: [{ rotate: '-4deg' }],
  },
  strip: {
    position: 'absolute',
    left: 42,
    bottom: 6,
    width: 36,
    height: 330,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 15,
    transform: [{ rotate: '-13deg' }],
    borderWidth: 1,
    borderColor: 'rgba(215,238,243,0.78)',
    ...shadows.soft,
  },
  pad: { width: 25, height: 25, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.62)' },
  actionPanel: {
    marginTop: 0,
    borderTopLeftRadius: 31,
    borderTopRightRadius: 31,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 24,
    paddingTop: 29,
    paddingBottom: 66,
    ...shadows.hero,
  },
  primaryButton: {
    minHeight: 66,
    borderRadius: 22,
    backgroundColor: colors.primary,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
    borderWidth: 3,
    borderColor: 'rgba(0,147,180,0.35)',
    ...shadows.button,
  },
  primaryIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { color: colors.white, fontFamily: typography.fontFamilyBold, fontSize: 27, fontWeight: '900', ...rtl.textCenter },
  loginButton: {
    marginTop: 14,
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 88,
    ...shadows.soft,
  },
  loginIcon: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center' },
  loginLabel: { color: colors.primaryDeep, fontFamily: typography.fontFamilyBold, fontSize: 23, fontWeight: '900', ...rtl.textCenter },
  featureRow: { marginTop: 23, flexDirection: 'row-reverse', gap: 16 },
  featureCard: { flex: 1, minHeight: 116, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, ...shadows.card },
  featureIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(8,175,203,0.08)', alignItems: 'center', justifyContent: 'center' },
  featureLabel: { marginTop: 12, color: '#0B3F72', fontFamily: typography.fontFamilyBold, fontSize: 14, fontWeight: '900', ...rtl.textCenter },
  chevrons: { marginTop: 20, alignItems: 'center', gap: 3 },
  chevron: { width: 17, height: 17, borderRightWidth: 4, borderBottomWidth: 4, borderColor: colors.primary, transform: [{ rotate: '45deg' }] },
  chevronSecond: { marginTop: -8, opacity: 0.72 },
  fakeTabBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    height: 76,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    ...shadows.tab,
  },
  fakeCenter: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(8,175,203,0.18)', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
