import type { ReactNode } from 'react';
import { ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const body = (
    <>
      <View style={styles.heroSpacer} />
      <BrandMark />

      <View style={styles.welcomeCopy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.segmented}>
        <Pressable onPress={onLoginTab} style={[styles.segment, activeMode === 'login' && styles.segmentActive]}>
          <Text style={[styles.segmentText, activeMode === 'login' && styles.segmentTextActive]}>התחברות</Text>
        </Pressable>
        <Pressable onPress={onSignupTab} style={[styles.segment, activeMode === 'signup' && styles.segmentActive]}>
          <Text style={[styles.segmentText, activeMode === 'signup' && styles.segmentTextActive]}>הרשמה</Text>
        </Pressable>
      </View>

      <View style={styles.formCard}>{children}{footer}</View>
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
      <View style={styles.webDeviceFrame}>
        <View style={styles.webPhone}>{screen}</View>
      </View>
    </View>
  );
}

export function AuthField({ icon, keyboardType, label, onChangeText, placeholder, secure, sideIcon, value }: AuthFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <LineIcon name={icon} color="#657789" size={23} />
        <TextInput
          autoCapitalize="none"
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#A8B2BD"
          secureTextEntry={secure}
          style={styles.input}
          value={value}
        />
        {sideIcon ? <LineIcon name={sideIcon} color="#657789" size={23} /> : <View style={styles.sideIconSpacer} />}
      </View>
    </View>
  );
}

export function AuthPrimaryButton({ busy, disabled, label, onPress }: { busy?: boolean; disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [styles.primaryButton, (disabled || busy) && styles.disabled, pressed && !disabled && styles.pressed]}>
      <Text style={styles.primaryLabel}>{busy ? 'טוען...' : label}</Text>
    </Pressable>
  );
}

export function AuthDivider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>או</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

export function SocialButton({ disabled, label, mark, onPress }: SocialButtonProps) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.socialButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
      {mark === 'apple' ? <LineIcon name="apple" color="#050505" size={31} /> : <GoogleMark />}
      <Text style={styles.socialLabel}>{label}</Text>
      <View style={styles.socialSpacer} />
    </Pressable>
  );
}

export function SecureDataNote() {
  return (
    <View style={styles.secureRow}>
      <LineIcon name="shield" color={colors.primary} size={17} />
      <Text style={styles.secureText}>הנתונים נשמרים בצורה מאובטחת</Text>
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

function GoogleMark() {
  return (
    <View style={styles.googleCircle}>
      <Text style={styles.googleBlue}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  webViewport: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF8FB', paddingVertical: 14 },
  webDeviceFrame: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxPhoneWidth,
    maxHeight: layout.maxPhoneHeight,
    borderRadius: 42,
    backgroundColor: '#080D11',
    borderWidth: 4,
    borderColor: '#111820',
    padding: 4,
    shadowColor: '#0B2730',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 10,
  },
  webPhone: { flex: 1, width: '100%', borderRadius: 36, overflow: 'hidden' },
  background: { flex: 1 },
  backgroundImage: { width: '100%', height: '100%' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 260, backgroundColor: 'rgba(232,249,255,0.04)' },
  whiteWash: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 642, backgroundColor: 'rgba(255,255,255,0.78)' },
  content: { minHeight: 812, paddingHorizontal: 30, paddingTop: 262, paddingBottom: 28 },
  fixedContent: { flex: 1, paddingHorizontal: 30, paddingTop: 258, paddingBottom: 18 },
  heroSpacer: { height: 0 },
  brandWrap: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandDip: { color: '#0A3D78', fontFamily: typography.fontFamilyExtraBold, fontSize: 38, fontWeight: '900' },
  brandCheck: { color: colors.primary, fontFamily: typography.fontFamilyExtraBold, fontSize: 38, fontWeight: '900' },
  brandSub: { marginTop: -8, color: '#153C6E', fontFamily: typography.fontFamilyRegular, fontSize: 19, fontWeight: '700', ...rtl.text },
  dropLogo: {
    width: 56,
    height: 66,
    borderRadius: 31,
    backgroundColor: 'rgba(8,175,203,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    borderWidth: 4,
    borderColor: 'rgba(114,216,233,0.84)',
  },
  welcomeCopy: { marginTop: 45, alignItems: 'flex-end' },
  title: { color: '#0A3D78', fontFamily: typography.fontFamilyExtraBold, fontSize: 37, fontWeight: '900', ...rtl.text },
  subtitle: { marginTop: 12, color: '#253447', fontFamily: typography.fontFamilyRegular, fontSize: 18, fontWeight: '600', lineHeight: 27, ...rtl.text },
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
  segment: { flex: 1, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.primary, ...shadows.button },
  segmentText: { color: '#89929D', fontFamily: typography.fontFamilyBold, fontSize: 20, fontWeight: '900' },
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
  fieldWrap: { gap: 8 },
  fieldLabel: { color: '#202938', fontFamily: typography.fontFamilyRegular, fontSize: 18, fontWeight: '700', ...rtl.text },
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
  input: { flex: 1, color: colors.text, fontFamily: typography.fontFamilyRegular, fontSize: 16, fontWeight: '600', textAlign: 'right', writingDirection: 'rtl' },
  sideIconSpacer: { width: 31, height: 31 },
  primaryButton: { minHeight: 63, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.button },
  primaryLabel: { color: colors.white, fontFamily: typography.fontFamilyBold, fontSize: 24, fontWeight: '900', ...rtl.textCenter },
  dividerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 14, marginVertical: 2 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E4E9EF' },
  dividerText: { color: '#657789', fontFamily: typography.fontFamilyRegular, fontSize: 17, fontWeight: '700' },
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
  socialLabel: { color: '#11181F', fontFamily: typography.fontFamilyRegular, fontSize: 19, fontWeight: '700' },
  socialSpacer: { width: 39, height: 39 },
  googleCircle: { width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  googleBlue: { color: '#4285F4', fontFamily: typography.fontFamilyBold, fontSize: 28, fontWeight: '900' },
  secureRow: { marginTop: 3, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secureText: { color: '#7B8895', fontFamily: typography.fontFamilyRegular, fontSize: 15, fontWeight: '700', ...rtl.textCenter },
  message: { fontFamily: typography.fontFamilySemiBold, fontSize: 13, fontWeight: '900', lineHeight: 19, ...rtl.text },
  error: { color: colors.danger },
  success: { color: colors.success },
  disabled: { opacity: 0.62 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
