import type { ReactNode } from 'react';
import { ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { LineIcon, type LineIconName } from './LineIcon';
import { colors, layout, radius, rtl, shadows, typography } from '../theme';

const authPool = require('../assets/welcome-pool.png');

type AuthMode = 'login' | 'signup';

interface AuthScreenShellProps {
  activeMode: AuthMode;
  children: ReactNode;
  footer: ReactNode;
  noScroll?: boolean;
  onLoginTab: () => void;
  onSignupTab: () => void;
  subtitle: string;
  title: string;
}

interface AuthFieldProps {
  compact?: boolean;
  icon: LineIconName;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secure?: boolean;
  sideIcon?: LineIconName;
  value: string;
}

interface SocialButtonProps {
  compact?: boolean;
  disabled?: boolean;
  label: string;
  mark: 'apple' | 'google';
  onPress?: () => void;
}

export function AuthScreenShell({
  activeMode,
  children,
  footer,
  noScroll = false,
  onLoginTab,
  onSignupTab,
  subtitle,
  title,
}: AuthScreenShellProps) {
  const viewport = useWindowDimensions();
  const webScale =
    Platform.OS === 'web'
      ? Math.min(1, (viewport.width - 28) / layout.maxPhoneWidth, (viewport.height - 28) / layout.maxPhoneHeight)
      : 1;

  const body = (
    <>
      <View style={styles.heroSpacer} />
      <View style={[styles.heroTextPanel, noScroll && styles.heroTextPanelCompact]}>
        <BrandMark />

        <View style={[styles.welcomeCopy, noScroll && styles.welcomeCopyCompact]}>
          <Text style={[styles.title, noScroll && styles.titleCompact]}>{title}</Text>
          <Text style={[styles.subtitle, noScroll && styles.subtitleCompact]}>{subtitle}</Text>
        </View>
      </View>

      <View style={[styles.segmented, noScroll && styles.segmentedCompact]}>
        <Pressable onPress={onLoginTab} style={[styles.segment, activeMode === 'login' && styles.segmentActive]}>
          <Text style={[styles.segmentText, noScroll && styles.segmentTextCompact, activeMode === 'login' && styles.segmentTextActive]}>התחברות</Text>
        </Pressable>
        <Pressable onPress={onSignupTab} style={[styles.segment, activeMode === 'signup' && styles.segmentActive]}>
          <Text style={[styles.segmentText, noScroll && styles.segmentTextCompact, activeMode === 'signup' && styles.segmentTextActive]}>הרשמה</Text>
        </Pressable>
      </View>

      <View style={[styles.formCard, noScroll && styles.formCardCompact]}>{children}{footer}</View>
    </>
  );

  const screen = (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <ImageBackground source={authPool} resizeMode="cover" style={styles.background} imageStyle={styles.backgroundImage}>
        <View pointerEvents="none" style={styles.topShade} />
        <View pointerEvents="none" style={styles.whiteWash} />
        {noScroll ? (
          <View style={styles.fixedContent}>{body}</View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
            {body}
          </ScrollView>
        )}
      </ImageBackground>
    </KeyboardAvoidingView>
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

export function AuthField({ compact, icon, keyboardType, label, onChangeText, placeholder, secure, sideIcon, value }: AuthFieldProps) {
  return (
    <View style={[styles.fieldWrap, compact && styles.fieldWrapCompact]}>
      <Text style={[styles.fieldLabel, compact && styles.fieldLabelCompact]}>{label}</Text>
      <View style={[styles.inputShell, compact && styles.inputShellCompact]}>
        <LineIcon name={icon} color="#657789" size={compact ? 19 : 23} />
        <TextInput
          autoCapitalize="none"
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#A8B2BD"
          secureTextEntry={secure}
          style={[styles.input, compact && styles.inputCompact]}
          value={value}
        />
        {sideIcon ? <LineIcon name={sideIcon} color="#657789" size={compact ? 19 : 23} /> : <View style={[styles.sideIconSpacer, compact && styles.sideIconSpacerCompact]} />}
      </View>
    </View>
  );
}

export function AuthFieldRow({ children }: { children: ReactNode }) {
  return <View style={styles.fieldRow}>{children}</View>;
}

export function AuthPrimaryButton({ busy, compact, disabled, label, onPress }: { busy?: boolean; compact?: boolean; disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [styles.primaryButton, compact && styles.primaryButtonCompact, (disabled || busy) && styles.disabled, pressed && !disabled && styles.pressed]}>
      <Text style={[styles.primaryLabel, compact && styles.primaryLabelCompact]}>{busy ? 'טוען...' : label}</Text>
    </Pressable>
  );
}

export function AuthDivider({ compact }: { compact?: boolean }) {
  return (
    <View style={[styles.dividerRow, compact && styles.dividerRowCompact]}>
      <View style={styles.dividerLine} />
      <Text style={[styles.dividerText, compact && styles.dividerTextCompact]}>או</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

export function SocialButton({ compact, disabled, label, mark, onPress }: SocialButtonProps) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.socialButton, compact && styles.socialButtonCompact, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
      {mark === 'apple' ? <LineIcon name="apple" color="#050505" size={compact ? 25 : 31} /> : <GoogleMark compact={compact} />}
      <Text style={[styles.socialLabel, compact && styles.socialLabelCompact]}>{label}</Text>
      <View style={[styles.socialSpacer, compact && styles.socialSpacerCompact]} />
    </Pressable>
  );
}

export function SecureDataNote({ compact }: { compact?: boolean }) {
  return (
    <View style={[styles.secureRow, compact && styles.secureRowCompact]}>
      <LineIcon name="shield" color={colors.primary} size={compact ? 14 : 17} />
      <Text style={[styles.secureText, compact && styles.secureTextCompact]}>הנתונים נשמרים בצורה מאובטחת</Text>
    </View>
  );
}

export function AuthMessage({ tone, text }: { tone: 'error' | 'success'; text?: string }) {
  if (!text) return null;
  return <Text style={[styles.message, tone === 'success' ? styles.success : styles.error]}>{text}</Text>;
}

function BrandMark() {
  return (
    <View style={styles.brandWrap}>
      <View style={styles.dropLogo}>
        <LineIcon name="check" color={colors.white} size={31} />
      </View>
      <View>
        <View style={styles.brandRow}>
          <Text style={styles.brandDip}>Dip</Text>
          <Text style={styles.brandCheck}>Check</Text>
        </View>
        <Text style={styles.brandSub}>בדיקת מים חכמה</Text>
      </View>
    </View>
  );
}

function GoogleMark({ compact }: { compact?: boolean }) {
  return (
    <View style={[styles.googleCircle, compact && styles.googleCircleCompact]}>
      <Text style={[styles.googleBlue, compact && styles.googleBlueCompact]}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  webViewport: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF8FB', padding: 14, overflow: 'hidden' },
  webDeviceFrame: {
    position: 'relative',
    borderRadius: 42,
    backgroundColor: '#080D11',
    borderWidth: 4,
    borderColor: '#111820',
    overflow: 'hidden',
    shadowColor: '#0B2730',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 10,
  },
  webPhone: { position: 'absolute', top: 0, left: 0, borderRadius: 36, overflow: 'hidden' },
  background: { flex: 1 },
  backgroundImage: { width: '100%', height: '100%' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 260, backgroundColor: 'rgba(232,249,255,0.14)' },
  whiteWash: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 642, backgroundColor: 'rgba(255,255,255,0.8)' },
  content: { minHeight: 812, paddingHorizontal: 30, paddingTop: 262, paddingBottom: 28 },
  fixedContent: { flex: 1, paddingHorizontal: 30, paddingTop: 48, paddingBottom: 8 },
  heroSpacer: { height: 0 },
  heroTextPanel: {
    alignItems: 'stretch',
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  heroTextPanelCompact: {
    borderRadius: 22,
    paddingHorizontal: 9,
    paddingTop: 7,
    paddingBottom: 8,
  },
  brandWrap: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 9 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandDip: { color: '#073669', fontFamily: typography.fontFamilyExtraBold, fontSize: 34, fontWeight: '900', textShadowColor: 'rgba(255,255,255,0.72)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  brandCheck: { color: colors.primary, fontFamily: typography.fontFamilyExtraBold, fontSize: 34, fontWeight: '900', textShadowColor: 'rgba(255,255,255,0.72)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  brandSub: { marginTop: -7, color: '#11345F', fontFamily: typography.fontFamilyRegular, fontSize: 16, fontWeight: '800', textShadowColor: 'rgba(255,255,255,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3, ...rtl.text },
  dropLogo: {
    width: 48,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(8,175,203,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    borderWidth: 4,
    borderColor: 'rgba(114,216,233,0.84)',
  },
  welcomeCopy: { marginTop: 34, alignItems: 'flex-end' },
  welcomeCopyCompact: { marginTop: 8 },
  title: { color: '#073669', fontFamily: typography.fontFamilyExtraBold, fontSize: 37, fontWeight: '900', textShadowColor: 'rgba(255,255,255,0.88)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5, ...rtl.text },
  titleCompact: { fontSize: 30 },
  subtitle: { marginTop: 12, color: '#142437', fontFamily: typography.fontFamilyRegular, fontSize: 18, fontWeight: '800', lineHeight: 27, textShadowColor: 'rgba(255,255,255,0.86)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4, ...rtl.text },
  subtitleCompact: { marginTop: 4, fontSize: 14, lineHeight: 19 },
  segmented: {
    marginTop: 30,
    minHeight: 72,
    borderRadius: radius.round,
    backgroundColor: 'rgba(255,255,255,0.92)',
    flexDirection: 'row-reverse',
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(215,238,243,0.8)',
    ...shadows.soft,
  },
  segmentedCompact: { marginTop: 9, minHeight: 45 },
  segment: { flex: 1, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.primary, ...shadows.button },
  segmentText: { color: '#89929D', fontFamily: typography.fontFamilyBold, fontSize: 20, fontWeight: '900' },
  segmentTextCompact: { fontSize: 16 },
  segmentTextActive: { color: colors.white },
  formCard: {
    marginTop: 18,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 24,
    gap: 16,
    ...shadows.hero,
  },
  formCardCompact: { marginTop: 10, borderRadius: 20, paddingHorizontal: 15, paddingTop: 13, paddingBottom: 12, gap: 8 },
  fieldWrap: { gap: 8 },
  fieldRow: { flexDirection: 'row-reverse', gap: 8 },
  fieldWrapCompact: { gap: 5 },
  fieldLabel: { color: '#202938', fontFamily: typography.fontFamilyRegular, fontSize: 18, fontWeight: '700', ...rtl.text },
  fieldLabelCompact: { fontSize: 12 },
  inputShell: {
    minHeight: 59,
    borderRadius: 13,
    borderWidth: 1.4,
    borderColor: '#C9D2DC',
    backgroundColor: 'rgba(255,255,255,0.78)',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  inputShellCompact: { minHeight: 39, borderRadius: 11, paddingHorizontal: 11, gap: 6 },
  input: { flex: 1, color: colors.text, fontFamily: typography.fontFamilyRegular, fontSize: 16, fontWeight: '600', textAlign: 'right', writingDirection: 'rtl' },
  inputCompact: { fontSize: 13 },
  sideIconSpacer: { width: 31, height: 31 },
  sideIconSpacerCompact: { width: 27, height: 27 },
  primaryButton: { minHeight: 63, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.button },
  primaryButtonCompact: { minHeight: 42, borderRadius: 12 },
  primaryLabel: { color: colors.white, fontFamily: typography.fontFamilyBold, fontSize: 24, fontWeight: '900', ...rtl.textCenter },
  primaryLabelCompact: { fontSize: 18 },
  dividerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 14, marginVertical: 2 },
  dividerRowCompact: { gap: 10, marginVertical: 1 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E4E9EF' },
  dividerText: { color: '#657789', fontFamily: typography.fontFamilyRegular, fontSize: 17, fontWeight: '700' },
  dividerTextCompact: { fontSize: 12 },
  socialButton: {
    minHeight: 59,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#EEF2F5',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 21,
    ...shadows.soft,
  },
  socialButtonCompact: { minHeight: 39, borderRadius: 11, paddingHorizontal: 15 },
  socialLabel: { color: '#11181F', fontFamily: typography.fontFamilyRegular, fontSize: 19, fontWeight: '700' },
  socialLabelCompact: { fontSize: 14 },
  socialSpacer: { width: 39, height: 39 },
  socialSpacerCompact: { width: 31, height: 31 },
  googleCircle: { width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  googleCircleCompact: { width: 31, height: 31 },
  googleBlue: { color: '#4285F4', fontFamily: typography.fontFamilyBold, fontSize: 28, fontWeight: '900' },
  googleBlueCompact: { fontSize: 23 },
  secureRow: { marginTop: 3, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secureRowCompact: { marginTop: 2, gap: 4 },
  secureText: { color: '#7B8895', fontFamily: typography.fontFamilyRegular, fontSize: 15, fontWeight: '700', ...rtl.textCenter },
  secureTextCompact: { fontSize: 11 },
  message: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, fontWeight: '900', lineHeight: 19, ...rtl.text },
  error: { color: colors.danger },
  success: { color: colors.success },
  disabled: { opacity: 0.62 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
