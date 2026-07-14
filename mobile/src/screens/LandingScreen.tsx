import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageBackground, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LineIcon, type LineIconName } from '../components/LineIcon';
import { colors, layout, rtl, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

type VisualType = 'strip' | 'phoneScan' | 'results' | 'recommendation' | 'plan';

interface OnboardingSlide {
  body: string;
  rows: Array<{ icon: LineIconName; text: string }>;
  title: string;
  visual: VisualType;
}

const ONBOARDING_COMPLETE_KEY = 'dipcheck:onboarding-complete:v2';
const welcomePool = require('../assets/welcome-pool.png');
const padColors = ['#9A68C9', '#E95F82', '#F27D40', '#F6C444', '#9FCC42', '#3BBE76', '#23A9C9'];
const TOTAL_STEPS = 5;

const onboardingSlides: OnboardingSlide[] = [
  {
    body: 'יוצרים בריכה, מזינים נפח בליטרים ובוחרים את סוג הסטיק שיש ברשותך.',
    rows: [
      { icon: 'pools', text: 'הזן שם ונפח בריכה בליטרים' },
      { icon: 'scan', text: 'בחר את הסטיק שבו תשתמש לבדיקה' },
      { icon: 'shield', text: 'ההגדרות נשמרות לבדיקות הבאות' },
    ],
    title: 'מתחילים עם הבריכה והסטיק',
    visual: 'strip',
  },
  {
    body: 'מצלמים תמונה ברורה של הסטיק, כשהצבעים נראים טוב ובתוך המסגרת.',
    rows: [
      { icon: 'image', text: 'החזק את הטלפון ישר מול הסטיק' },
      { icon: 'flash', text: 'ודא תאורה טובה וללא צל חזק' },
      { icon: 'scan', text: 'צלם כשהסטיק כולו מופיע בתמונה' },
    ],
    title: 'מצלמים את הסטיק',
    visual: 'phoneScan',
  },
  {
    body: 'כל ערך מוצג בצורה פשוטה וברורה כדי שתדע אם מי הבריכה מאוזנים.',
    rows: [
      { icon: 'drop', text: 'בדוק את ערכי ה-pH, הכלור והאלקליניות' },
      { icon: 'results', text: 'ראה אם כל ערך תקין לפי הצבעים' },
      { icon: 'history', text: 'קבל תוצאה מסודרת וברורה בכל בדיקה' },
    ],
    title: 'רואים אם הבריכה מאוזנת',
    visual: 'results',
  },
  {
    body: 'לפי נתוני הבריכה והתוצאה תקבל המלצה כמה חומר להוסיף כדי לאזן את המים.',
    rows: [
      { icon: 'results', text: 'ראה איזו פעולה מומלץ לבצע קודם' },
      { icon: 'drop', text: 'קבל המלצה מדויקת לכמות החומר' },
      { icon: 'shield', text: 'שמור על איזון מים נכון בקלות' },
    ],
    title: 'מקבלים המלצה מותאמת',
    visual: 'recommendation',
  },
  {
    body: 'בחר את המסלול שמתאים לך כדי להתחיל להשתמש באפליקציה.',
    rows: [
      { icon: 'drop', text: '200 סריקות בכל חודש' },
      { icon: 'pools', text: 'בריכה אחת כלולה במנוי' },
      { icon: 'flash', text: 'תוצאות והמלצות מיידיות' },
    ],
    title: 'ממשיכים עם מנוי',
    visual: 'plan',
  },
];

export function LandingScreen({ navigation }: Props) {
  const [index, setIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const viewport = useWindowDimensions();
  const effectiveHeight = Platform.OS === 'web' ? layout.maxPhoneHeight : viewport.height;
  const compact = effectiveHeight < 900;
  const veryCompact = effectiveHeight < 760;
  const current = onboardingSlides[index];
  const isLast = index === onboardingSlides.length - 1;

  const webScale = useMemo(() => {
    if (Platform.OS !== 'web') return 1;
    return Math.min(1, (viewport.width - 28) / layout.maxPhoneWidth, (viewport.height - 28) / layout.maxPhoneHeight);
  }, [viewport.height, viewport.width]);

  useEffect(() => {
    let mounted = true;
    async function loadCompletion() {
      try {
        const completed = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        if (!mounted) return;
        if (completed === 'true') {
          navigation.replace('Login');
          return;
        }
      } finally {
        if (mounted) setHydrated(true);
      }
    }
    loadCompletion();
    return () => {
      mounted = false;
    };
  }, [navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (index <= 0) return;
      event.preventDefault();
      setIndex((value) => Math.max(0, value - 1));
    });
    return unsubscribe;
  }, [index, navigation]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  }, []);

  const next = useCallback(async () => {
    if (!isLast) {
      setIndex((value) => Math.min(onboardingSlides.length - 1, value + 1));
      return;
    }
    await completeOnboarding();
    navigation.navigate('Signup');
  }, [completeOnboarding, isLast, navigation]);

  const skip = useCallback(async () => {
    if (!isLast) {
      setIndex(onboardingSlides.length - 1);
      return;
    }
    await completeOnboarding();
    navigation.navigate('Login');
  }, [completeOnboarding, isLast, navigation]);

  if (!hydrated) {
    return <View style={styles.root} />;
  }

  const screen = (
    <OnboardingScreen compact={compact} scrollRef={scrollRef} veryCompact={veryCompact}>
      <OnboardingHeader compact={compact} index={index} slide={current} />
      <HeroSection compact={compact} type={current.visual} />
      <InstructionCard compact={compact} index={index} isLast={isLast} rows={current.rows}>
        {isLast ? <SubscriptionPaywall compact={compact} /> : null}
        <PrimaryButton compact={compact} label={isLast ? 'המשך למנוי' : 'הבא'} onPress={next} />
        <OnboardingDots activeIndex={index} count={TOTAL_STEPS} />
        <SkipButton compact={compact} label={isLast ? 'לא עכשיו' : 'דלג'} onPress={skip} />
      </InstructionCard>
    </OnboardingScreen>
  );

  if (Platform.OS !== 'web') {
    return screen;
  }

  return (
    <View style={styles.webViewport}>
      <View
        style={[
          styles.webDeviceFrame,
          {
            width: layout.maxPhoneWidth * webScale,
            height: layout.maxPhoneHeight * webScale,
            borderRadius: 42 * webScale,
            borderWidth: 4 * webScale,
          },
        ]}
      >
        <View
          style={[
            styles.webPhone,
            {
              width: layout.maxPhoneWidth,
              height: layout.maxPhoneHeight,
              transform: [{ scale: webScale }],
              transformOrigin: 'top left',
            } as object,
          ]}
        >
          {screen}
        </View>
      </View>
    </View>
  );
}

function OnboardingScreen({
  children,
  compact,
  scrollRef,
  veryCompact,
}: {
  children: React.ReactNode;
  compact: boolean;
  scrollRef: React.RefObject<ScrollView | null>;
  veryCompact: boolean;
}) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <ImageBackground source={welcomePool} resizeMode="cover" style={styles.background} imageStyle={styles.backgroundImage}>
        <View pointerEvents="none" style={styles.backgroundOverlay} />
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <ScrollView
            bounces={false}
            contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact, veryCompact && styles.scrollContentVeryCompact]}
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

function OnboardingHeader({ compact, index, slide }: { compact: boolean; index: number; slide: OnboardingSlide }) {
  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      <View style={styles.brandRow}>
        <Text style={[styles.brandDip, compact && styles.brandTextCompact]}>Dip</Text>
        <Text style={[styles.brandCheck, compact && styles.brandTextCompact]}>Check</Text>
        <View style={[styles.dropLogo, compact && styles.dropLogoCompact]}>
          <LineIcon name="check" color={colors.white} size={compact ? 16 : 21} />
        </View>
      </View>
      <ProgressPill compact={compact} index={index} />
      <View style={[styles.headlineWrap, compact && styles.headlineWrapCompact]}>
        <View pointerEvents="none" style={[styles.headlineGlow, compact && styles.headlineGlowCompact]} />
        <View style={[styles.headlinePanel, compact && styles.headlinePanelCompact]}>
          <Text style={[styles.title, compact && styles.titleCompact]}>{slide.title}</Text>
          <Text style={[styles.body, compact && styles.bodyCompact]}>{slide.body}</Text>
        </View>
      </View>
    </View>
  );
}

function ProgressPill({ compact, index }: { compact: boolean; index: number }) {
  return (
    <View style={[styles.progressPill, compact && styles.progressPillCompact]}>
      <Text style={[styles.progressText, compact && styles.progressTextCompact]}>{`שלב ${index + 1} מתוך ${TOTAL_STEPS}`}</Text>
    </View>
  );
}

function HeroSection({ compact, type }: { compact: boolean; type: VisualType }) {
  if (type === 'results') return <ResultsVisual compact={compact} />;
  if (type === 'recommendation') return <RecommendationVisual compact={compact} />;
  if (type === 'plan') return <PlanVisual compact={compact} />;

  return (
    <View style={[styles.scanScene, compact && styles.scanSceneCompact]}>
      <ScanFrame compact={compact} phone={type === 'phoneScan'} />
      <TestStrip compact={compact} withFinger={type !== 'strip'} />
    </View>
  );
}

function InstructionCard({
  children,
  compact,
  index,
  isLast,
  rows,
}: {
  children: React.ReactNode;
  compact: boolean;
  index: number;
  isLast: boolean;
  rows: OnboardingSlide['rows'];
}) {
  return (
    <View style={[styles.instructionCard, compact && styles.instructionCardCompact, compact && isLast && styles.instructionCardLastCompact]}>
      <View style={[styles.sheetBadge, compact && styles.sheetBadgeCompact]}>
        <LineIcon name="drop" color={colors.white} size={compact ? 21 : 27} />
      </View>
      <Text style={[styles.sheetTitle, compact && styles.sheetTitleCompact]}>{isLast ? 'במנוי תיהנה מ:' : `שלב ${index + 1} - ${sheetTitleFor(index)}`}</Text>
      <View style={[styles.checkList, compact && styles.checkListCompact, compact && isLast && styles.checkListLastCompact]}>
        {rows.map((item) => (
          <InstructionRow compact={compact} icon={item.icon} key={item.text} text={item.text} />
        ))}
      </View>
      {children}
    </View>
  );
}

function InstructionRow({ compact, icon, text }: { compact: boolean; icon: LineIconName; text: string }) {
  return (
    <View style={[styles.checkRow, compact && styles.checkRowCompact]}>
      <LineIcon name="check" color={colors.primary} size={compact ? 16 : 18} />
      <View style={[styles.checkIcon, compact && styles.checkIconCompact]}>
        <LineIcon name={icon} color={NAVY} size={compact ? 19 : 23} />
      </View>
      <Text style={[styles.checkText, compact && styles.checkTextCompact]}>{text}</Text>
    </View>
  );
}

function OnboardingDots({ activeIndex, count }: { activeIndex: number; count: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }).map((_, dotIndex) => (
        <View key={dotIndex} style={[styles.dot, dotIndex === activeIndex && styles.dotActive]} />
      ))}
    </View>
  );
}

function PrimaryButton({ compact, label, onPress }: { compact: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.primaryButton, compact && styles.primaryButtonCompact, pressed && styles.pressed]}>
      <Text style={[styles.primaryLabel, compact && styles.primaryLabelCompact]}>{label}</Text>
    </Pressable>
  );
}

function SkipButton({ compact, label, onPress }: { compact: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
      <Text style={[styles.skipText, compact && styles.skipTextCompact]}>{label}</Text>
    </Pressable>
  );
}

function SubscriptionPaywall({ compact }: { compact: boolean }) {
  return (
    <View style={[styles.planBox, compact && styles.planBoxCompact]}>
      <View style={styles.ribbon}>
        <LineIcon name="check" color={colors.white} size={18} />
      </View>
      <Text style={[styles.planName, compact && styles.planNameCompact]}>מנוי חודשי</Text>
      <View style={styles.priceLine}>
        <Text style={[styles.price, compact && styles.priceCompact]}>30</Text>
        <Text style={[styles.currency, compact && styles.currencyCompact]}>₪ לחודש</Text>
      </View>
      <View style={styles.addonsRow}>
        <View style={styles.addon}>
          <Text style={styles.addonText}>200 סריקות נוספות</Text>
          <Text style={styles.addonPrice}>20 ₪</Text>
        </View>
        <View style={styles.addon}>
          <Text style={styles.addonText}>בריכה נוספת</Text>
          <Text style={styles.addonPrice}>10 ₪ לחודש</Text>
        </View>
      </View>
    </View>
  );
}

function sheetTitleFor(index: number) {
  if (index === 0) return 'בריכה וסטיק';
  if (index === 1) return 'צילום הסטיק';
  if (index === 2) return 'צופים בתוצאות';
  return 'איזון מי הבריכה';
}

function ScanFrame({ compact, phone }: { compact: boolean; phone?: boolean }) {
  return (
    <View style={[styles.scanFrame, compact && styles.scanFrameCompact, phone && styles.phoneFrame]}>
      <View style={[styles.corner, styles.cornerTopRight]} />
      <View style={[styles.corner, styles.cornerTopLeft]} />
      <View style={[styles.corner, styles.cornerBottomRight]} />
      <View style={[styles.corner, styles.cornerBottomLeft]} />
      {phone ? <View style={styles.phoneCamera} /> : null}
    </View>
  );
}

function TestStrip({ compact, withFinger }: { compact: boolean; withFinger?: boolean }) {
  return (
    <View style={[styles.stripHolder, compact && styles.stripHolderCompact]}>
      <View style={[styles.strip, compact && styles.stripCompact]}>
        {padColors.map((color) => (
          <View key={color} style={[styles.pad, compact && styles.padCompact, { backgroundColor: color }]} />
        ))}
      </View>
      {withFinger ? <View style={[styles.finger, compact && styles.fingerCompact]} /> : null}
    </View>
  );
}

function ResultsVisual({ compact }: { compact: boolean }) {
  const rows = [
    { label: 'pH', status: 'תקין', value: '7.4', color: colors.success, icon: 'drop' as LineIconName },
    { label: 'Cl', status: 'תקין', value: '1.5', color: colors.success, icon: 'drop' as LineIconName },
    { label: 'Alk', status: 'גבוה', value: '120', color: colors.warning, icon: 'results' as LineIconName },
    { label: 'CYA', status: 'תקין', value: '50', color: colors.success, icon: 'shield' as LineIconName },
  ];

  return (
    <View style={[styles.resultsFrame, compact && styles.resultsFrameCompact]}>
      <ScanFrame compact={compact} />
      <View style={[styles.resultsCard, compact && styles.resultsCardCompact]}>
        <Text style={[styles.resultsHeading, compact && styles.resultsHeadingCompact]}>התוצאות שלך</Text>
        {rows.map((row) => (
          <View key={row.label} style={[styles.resultRow, compact && styles.resultRowCompact]}>
            <View style={styles.resultMeta}>
              <Text style={[styles.resultCode, compact && styles.resultCodeCompact]}>{row.label}</Text>
              <View style={styles.resultIcon}>
                <LineIcon name={row.icon} color={colors.primary} size={compact ? 15 : 17} />
              </View>
            </View>
            <View style={styles.resultBar}>
              <View style={[styles.barSegment, { backgroundColor: '#F25D70' }]} />
              <View style={[styles.barSegment, { backgroundColor: '#F6C04D' }]} />
              <View style={[styles.barSegmentWide, { backgroundColor: '#43B96E' }]} />
              <View style={[styles.barSegment, { backgroundColor: '#7C5CCB' }]} />
              <View style={[styles.barNeedle, { left: row.status === 'גבוה' ? '66%' : '58%' }]} />
            </View>
            <Text style={[styles.resultValue, { color: row.color }, compact && styles.resultValueCompact]}>{row.value}</Text>
            <Text style={[styles.resultStatus, { color: row.color }, compact && styles.resultStatusCompact]}>{row.status}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RecommendationVisual({ compact }: { compact: boolean }) {
  const rows = [
    ['pH', '7.2 - 7.6', 'בטווח מומלץ', 'drop' as LineIconName],
    ['כלור', '150 גרם', 'הוסף', 'flash' as LineIconName],
    ['מייצב כלור', '300 גרם', 'הוסף', 'shield' as LineIconName],
  ];

  return (
    <View style={[styles.recommendCard, compact && styles.recommendCardCompact]}>
      <Text style={[styles.recommendTitle, compact && styles.recommendTitleCompact]}>ההמלצה שלך</Text>
      <View style={[styles.volumeBox, compact && styles.volumeBoxCompact]}>
        <Text style={styles.volumeLabel}>נפח הבריכה</Text>
        <Text style={[styles.volumeValue, compact && styles.volumeValueCompact]}>40,000 ליטר</Text>
      </View>
      {rows.map(([label, value, note, icon]) => (
        <View key={label} style={[styles.recommendRow, compact && styles.recommendRowCompact]}>
          <View style={styles.recommendIcon}>
            <LineIcon name={icon as LineIconName} color={colors.white} size={compact ? 15 : 18} />
          </View>
          <Text style={[styles.recommendParam, compact && styles.recommendParamCompact]}>{label}</Text>
          <View style={styles.recommendValueBox}>
            <Text style={[styles.recommendValue, compact && styles.recommendValueCompact]}>{value}</Text>
            <Text style={[styles.recommendNote, compact && styles.recommendNoteCompact]}>{note}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function PlanVisual({ compact }: { compact: boolean }) {
  return (
    <View style={[styles.planHero, compact && styles.planHeroCompact]}>
      <TestStrip compact={compact} />
      <View style={[styles.bigDrop, compact && styles.bigDropCompact]}>
        <LineIcon name="drop" color={colors.white} size={compact ? 46 : 60} />
      </View>
      <View style={[styles.shieldHero, compact && styles.shieldHeroCompact]}>
        <LineIcon name="shield" color={colors.white} size={compact ? 40 : 54} />
      </View>
    </View>
  );
}

const NAVY = '#073A78';
const TURQUOISE = '#09AFC8';
const LIGHT_AQUA = '#E8F8FB';
const MUTED = '#42658B';
const DIVIDER = '#D5EDF2';
const INACTIVE_DOT = '#CFDCE3';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LIGHT_AQUA },
  webViewport: {
    alignItems: 'center',
    backgroundColor: '#EAF8FB',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 14,
  },
  webDeviceFrame: {
    backgroundColor: '#080D11',
    borderColor: '#111820',
    borderRadius: 42,
    borderWidth: 4,
    elevation: 10,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0B2730',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
  },
  webPhone: { borderRadius: 36, left: 0, overflow: 'hidden', position: 'absolute', top: 0 },
  background: { flex: 1 },
  backgroundImage: { height: '100%', width: '100%' },
  backgroundOverlay: {
    backgroundColor: 'rgba(232,248,251,0.24)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    minHeight: layout.maxPhoneHeight,
    paddingTop: 32,
  },
  scrollContentCompact: { minHeight: 720, paddingTop: 10 },
  scrollContentVeryCompact: { minHeight: 680, paddingTop: 8 },
  header: { alignItems: 'center', paddingHorizontal: 24 },
  headerCompact: { paddingHorizontal: 20 },
  brandRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginBottom: 18 },
  brandDip: {
    color: NAVY,
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 0,
  },
  brandCheck: {
    color: TURQUOISE,
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 0,
  },
  brandTextCompact: { fontSize: 30 },
  dropLogo: {
    alignItems: 'center',
    backgroundColor: 'rgba(9,175,200,0.82)',
    borderBottomLeftRadius: 38,
    borderBottomRightRadius: 38,
    borderColor: 'rgba(125,221,236,0.9)',
    borderRadius: 31,
    borderWidth: 4,
    height: 64,
    justifyContent: 'center',
    marginLeft: 14,
    transform: [{ rotate: '45deg' }],
    width: 54,
  },
  dropLogoCompact: { height: 46, marginLeft: 8, width: 39 },
  progressPill: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 18,
    marginBottom: 28,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  progressPillCompact: { marginBottom: 8, paddingHorizontal: 16, paddingVertical: 5 },
  progressText: {
    color: NAVY,
    fontFamily: typography.fontFamilyBold,
    fontSize: 17,
    fontWeight: '700',
    ...rtl.textCenter,
  },
  progressTextCompact: { fontSize: 15 },
  headlineWrap: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 4,
    position: 'relative',
  },
  headlineWrapCompact: { paddingHorizontal: 0 },
  headlineGlow: {
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: 42,
    bottom: -8,
    left: 2,
    position: 'absolute',
    right: 2,
    top: -8,
  },
  headlineGlowCompact: {
    borderRadius: 30,
    bottom: -5,
    left: 0,
    right: 0,
    top: -5,
  },
  headlinePanel: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderColor: 'rgba(255,255,255,0.58)',
    borderRadius: 34,
    borderWidth: 1,
    marginHorizontal: -2,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.72,
    shadowRadius: 24,
  },
  headlinePanelCompact: {
    borderRadius: 26,
    marginHorizontal: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  title: {
    color: NAVY,
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 39,
    fontWeight: '800',
    lineHeight: 48,
    maxWidth: 350,
    textShadowColor: 'rgba(255,255,255,0.94)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    ...rtl.textCenter,
  },
  titleCompact: { fontSize: 28, lineHeight: 33 },
  body: {
    color: NAVY,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 21,
    lineHeight: 31,
    marginTop: 14,
    maxWidth: 330,
    textShadowColor: 'rgba(255,255,255,0.96)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
    ...rtl.textCenter,
  },
  bodyCompact: { fontSize: 15, lineHeight: 21, marginTop: 5 },
  scanScene: { alignItems: 'center', alignSelf: 'center', height: 284, justifyContent: 'center', width: 320 },
  scanSceneCompact: { height: 184, width: 250 },
  scanFrame: {
    borderColor: 'rgba(255,255,255,0.72)',
    borderRadius: 34,
    borderWidth: 2,
    height: 220,
    position: 'absolute',
    width: 250,
  },
  scanFrameCompact: { borderRadius: 26, height: 150, width: 196 },
  phoneFrame: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: colors.white, borderWidth: 9, height: 250, width: 204 },
  corner: { borderColor: colors.white, height: 42, position: 'absolute', width: 42 },
  cornerTopRight: { borderRightWidth: 6, borderTopWidth: 6, right: -5, top: -5 },
  cornerTopLeft: { borderLeftWidth: 6, borderTopWidth: 6, left: -5, top: -5 },
  cornerBottomRight: { borderBottomWidth: 6, borderRightWidth: 6, bottom: -5, right: -5 },
  cornerBottomLeft: { borderBottomWidth: 6, borderLeftWidth: 6, bottom: -5, left: -5 },
  phoneCamera: { backgroundColor: NAVY, borderRadius: 8, height: 16, position: 'absolute', top: 14, width: 16 },
  stripHolder: { alignItems: 'center', height: 266, justifyContent: 'center', width: 86, zIndex: 2 },
  stripHolderCompact: { height: 176, width: 62 },
  strip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(215,238,243,0.78)',
    borderRadius: 14,
    borderWidth: 1,
    height: 252,
    justifyContent: 'space-evenly',
    paddingVertical: 16,
    width: 44,
    ...shadows.soft,
  },
  stripCompact: { borderRadius: 10, height: 164, width: 32 },
  pad: { borderColor: 'rgba(255,255,255,0.65)', borderRadius: 5, borderWidth: 1, height: 25, width: 25 },
  padCompact: { height: 16, width: 16 },
  finger: { backgroundColor: '#F2B18B', borderColor: '#F9CDB6', borderRadius: 34, borderWidth: 3, bottom: -28, height: 66, position: 'absolute', width: 66 },
  fingerCompact: { bottom: -18, height: 44, width: 44 },
  resultsFrame: { alignItems: 'center', alignSelf: 'center', height: 286, justifyContent: 'center', width: 330 },
  resultsFrameCompact: { height: 190, width: 270 },
  resultsCard: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 24, padding: 14, width: 266, ...shadows.card },
  resultsCardCompact: { borderRadius: 19, padding: 8, width: 228 },
  resultsHeading: { color: NAVY, fontFamily: typography.fontFamilyBold, fontSize: 18, fontWeight: '700', marginBottom: 8, ...rtl.textCenter },
  resultsHeadingCompact: { fontSize: 15, marginBottom: 5 },
  resultRow: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, flexDirection: 'row-reverse', gap: 8, marginBottom: 8, paddingHorizontal: 9, paddingVertical: 8 },
  resultRowCompact: { gap: 5, marginBottom: 5, paddingHorizontal: 7, paddingVertical: 5 },
  resultMeta: { alignItems: 'center', flexDirection: 'row-reverse', gap: 4, minWidth: 52 },
  resultCode: { color: NAVY, fontFamily: typography.fontFamilyBold, fontSize: 17, fontWeight: '700' },
  resultCodeCompact: { fontSize: 14 },
  resultIcon: { alignItems: 'center', backgroundColor: LIGHT_AQUA, borderRadius: 16, height: 30, justifyContent: 'center', width: 30 },
  resultBar: { borderRadius: 4, flex: 1, flexDirection: 'row-reverse', height: 6, overflow: 'hidden', position: 'relative' },
  barSegment: { flex: 1 },
  barSegmentWide: { flex: 2 },
  barNeedle: { backgroundColor: colors.success, borderRadius: 3, height: 12, position: 'absolute', top: -3, width: 6 },
  resultValue: { fontFamily: typography.fontFamilyBold, fontSize: 18, fontWeight: '700', minWidth: 38, ...rtl.textCenter },
  resultValueCompact: { fontSize: 15, minWidth: 30 },
  resultStatus: { fontFamily: typography.fontFamilyBold, fontSize: 14, fontWeight: '700', minWidth: 36, ...rtl.text },
  resultStatusCompact: { fontSize: 12, minWidth: 30 },
  recommendCard: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.9)', borderColor: colors.white, borderRadius: 24, borderWidth: 8, marginTop: 18, padding: 16, width: 270, ...shadows.card },
  recommendCardCompact: { borderRadius: 19, borderWidth: 5, marginTop: 5, padding: 9, width: 232 },
  recommendTitle: { color: NAVY, fontFamily: typography.fontFamilyBold, fontSize: 19, fontWeight: '700', marginBottom: 9, ...rtl.textCenter },
  recommendTitleCompact: { fontSize: 16, marginBottom: 6 },
  volumeBox: { backgroundColor: colors.white, borderRadius: 14, marginBottom: 10, padding: 12, ...shadows.soft },
  volumeBoxCompact: { marginBottom: 7, padding: 9 },
  volumeLabel: { color: MUTED, fontFamily: typography.fontFamilySemiBold, fontSize: 12, fontWeight: '600', ...rtl.textCenter },
  volumeValue: { color: NAVY, fontFamily: typography.fontFamilyExtraBold, fontSize: 25, fontWeight: '800', ...rtl.textCenter },
  volumeValueCompact: { fontSize: 20 },
  recommendRow: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, flexDirection: 'row-reverse', gap: 9, marginTop: 7, padding: 10 },
  recommendRowCompact: { gap: 5, marginTop: 4, padding: 7 },
  recommendIcon: { alignItems: 'center', backgroundColor: TURQUOISE, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  recommendParam: { color: NAVY, fontFamily: typography.fontFamilyBold, fontSize: 15, fontWeight: '700', minWidth: 54, ...rtl.text },
  recommendParamCompact: { fontSize: 13, minWidth: 45 },
  recommendValueBox: { flex: 1 },
  recommendValue: { color: TURQUOISE, fontFamily: typography.fontFamilyBold, fontSize: 19, fontWeight: '700', ...rtl.text },
  recommendValueCompact: { fontSize: 16 },
  recommendNote: { color: MUTED, fontFamily: typography.fontFamilySemiBold, fontSize: 11, fontWeight: '600', ...rtl.text },
  recommendNoteCompact: { fontSize: 10 },
  planHero: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 22, height: 280, justifyContent: 'center', width: 310 },
  planHeroCompact: { gap: 12, height: 150, width: 240 },
  bigDrop: { alignItems: 'center', backgroundColor: 'rgba(9,175,200,0.58)', borderColor: 'rgba(255,255,255,0.78)', borderRadius: 55, borderWidth: 2, height: 110, justifyContent: 'center', width: 90 },
  bigDropCompact: { borderRadius: 42, height: 84, width: 70 },
  shieldHero: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.7)', borderRadius: 48, borderWidth: 2, height: 96, justifyContent: 'center', width: 82 },
  shieldHeroCompact: { height: 74, width: 64 },
  instructionCard: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,
    marginTop: 0,
    minHeight: 350,
    paddingBottom: 24,
    paddingHorizontal: 34,
    paddingTop: 58,
    ...shadows.hero,
  },
  instructionCardCompact: { borderTopLeftRadius: 34, borderTopRightRadius: 34, minHeight: 292, paddingBottom: 12, paddingHorizontal: 24, paddingTop: 38 },
  instructionCardLastCompact: { paddingTop: 32 },
  sheetBadge: { alignItems: 'center', alignSelf: 'center', backgroundColor: TURQUOISE, borderColor: 'rgba(189,239,247,0.95)', borderRadius: 36, borderWidth: 7, height: 72, justifyContent: 'center', position: 'absolute', top: -36, width: 72 },
  sheetBadgeCompact: { borderRadius: 27, borderWidth: 5, height: 54, top: -27, width: 54 },
  sheetTitle: { color: NAVY, fontFamily: typography.fontFamilyExtraBold, fontSize: 27, fontWeight: '800', marginBottom: 10, ...rtl.textCenter },
  sheetTitleCompact: { fontSize: 21, marginBottom: 4 },
  checkList: { marginBottom: 17 },
  checkListCompact: { marginBottom: 8 },
  checkListLastCompact: { marginBottom: 5 },
  checkRow: { alignItems: 'center', borderBottomColor: DIVIDER, borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: 55 },
  checkRowCompact: { gap: 8, minHeight: 39 },
  checkIcon: { alignItems: 'center', backgroundColor: LIGHT_AQUA, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  checkIconCompact: { borderRadius: 16, height: 32, width: 32 },
  checkText: { color: NAVY, flex: 1, fontFamily: typography.fontFamilySemiBold, fontSize: 18, fontWeight: '600', ...rtl.text },
  checkTextCompact: { fontSize: 14 },
  planBox: { borderColor: TURQUOISE, borderRadius: 18, borderWidth: 2, marginBottom: 12, padding: 11, position: 'relative' },
  planBoxCompact: { marginBottom: 7, padding: 7 },
  ribbon: { alignItems: 'center', backgroundColor: TURQUOISE, borderBottomLeftRadius: 6, height: 48, justifyContent: 'center', position: 'absolute', right: 0, top: 0, width: 36 },
  planName: { color: NAVY, fontFamily: typography.fontFamilyExtraBold, fontSize: 23, fontWeight: '800', ...rtl.textCenter },
  planNameCompact: { fontSize: 17 },
  priceLine: { alignItems: 'baseline', flexDirection: 'row-reverse', gap: 8, justifyContent: 'center' },
  price: { color: TURQUOISE, fontFamily: typography.fontFamilyExtraBold, fontSize: 38, fontWeight: '800' },
  priceCompact: { fontSize: 25 },
  currency: { color: NAVY, fontFamily: typography.fontFamilyBold, fontSize: 18, fontWeight: '700' },
  currencyCompact: { fontSize: 13 },
  addonsRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 8 },
  addon: { backgroundColor: '#F5FCFD', borderColor: 'rgba(9,175,200,0.18)', borderRadius: 12, borderWidth: 1, flex: 1, padding: 7 },
  addonText: { color: NAVY, fontFamily: typography.fontFamilySemiBold, fontSize: 11, fontWeight: '600', ...rtl.textCenter },
  addonPrice: { color: TURQUOISE, fontFamily: typography.fontFamilyBold, fontSize: 15, fontWeight: '700', ...rtl.textCenter },
  primaryButton: { alignItems: 'center', backgroundColor: TURQUOISE, borderRadius: 22, justifyContent: 'center', minHeight: 64, ...shadows.button },
  primaryButtonCompact: { borderRadius: 17, minHeight: 47 },
  primaryLabel: { color: colors.white, fontFamily: typography.fontFamilyExtraBold, fontSize: 28, fontWeight: '800', ...rtl.textCenter },
  primaryLabelCompact: { fontSize: 21 },
  dots: { alignItems: 'center', flexDirection: 'row-reverse', gap: 12, justifyContent: 'center', marginTop: 9 },
  dot: { backgroundColor: INACTIVE_DOT, borderRadius: 6, height: 12, width: 12 },
  dotActive: { backgroundColor: TURQUOISE },
  skipButton: { alignSelf: 'center', marginTop: 5, paddingHorizontal: 20, paddingVertical: 1 },
  skipText: { color: colors.primaryDark, fontFamily: typography.fontFamilyBold, fontSize: 18, fontWeight: '700', ...rtl.textCenter },
  skipTextCompact: { fontSize: 16 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
