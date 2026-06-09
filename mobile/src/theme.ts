import { Platform } from 'react-native';

const appFont = (family: string) =>
  Platform.select({
    web: `${family}, Arial, sans-serif`,
    default: family,
  }) as string;

export const colors = {
  background: '#F1FBFD',
  backgroundAlt: '#F8FEFF',
  backgroundDeep: '#E4F7FB',
  backgroundSoft: '#ECFAFD',
  water: '#BCEFF7',
  waterDeep: '#66D2E5',
  waterDark: '#0AA7C7',
  surface: '#FFFFFF',
  surfaceSoft: '#F7FDFF',
  card: '#FFFFFF',
  cardSoft: 'rgba(255,255,255,0.94)',
  text: '#173A57',
  textSoft: '#547083',
  muted: '#8BA8B0',
  border: '#D7EEF3',
  borderSoft: '#EAF7FA',
  borderStrong: '#BFE5EE',
  subtle: '#ECF9FC',
  subtle2: '#CFEFF6',
  primary: '#08AFCB',
  primaryDark: '#0393AC',
  primaryDeep: '#096A86',
  primaryLight: '#5ED1E4',
  primarySoft: '#DDF8FC',
  navy: '#18AFCB',
  navySoft: '#55C9DC',
  success: '#22B983',
  successSoft: '#EAF9F3',
  warning: '#F0A529',
  warningSoft: '#FFF6DF',
  danger: '#E75C62',
  dangerSoft: '#FFF0F1',
  tabInactive: '#93AEB6',
  white: '#FFFFFF',
  whiteSoft: 'rgba(255,255,255,0.9)',
  whiteMuted: 'rgba(255,255,255,0.82)',
  glass: 'rgba(255,255,255,0.82)',
  blackSoft: 'rgba(17,56,68,0.09)',
  overlay: 'rgba(17,56,68,0.45)',
  shadow: '#0B5968',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  xxl: 44,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 34,
  round: 999,
};

export const typography = {
  fontFamily: appFont('Heebo_500Medium'),
  fontFamilyRegular: appFont('Heebo_400Regular'),
  fontFamilyMedium: appFont('Heebo_500Medium'),
  fontFamilySemiBold: appFont('Heebo_600SemiBold'),
  fontFamilyBold: appFont('Heebo_700Bold'),
  fontFamilyExtraBold: appFont('Heebo_800ExtraBold'),
  brandSpacing: 2.4,
  sizes: {
    caption: 11,
    small: 13,
    body: 15,
    subtitle: 18,
    title: 27,
    display: 32,
  },
  lineHeights: {
    body: 23,
    subtitle: 27,
    title: 35,
    display: 40,
  },
};

export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 4,
  },
  soft: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.055,
    shadowRadius: 12,
    elevation: 2,
  },
  button: {
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  tab: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.11,
    shadowRadius: 18,
    elevation: 8,
  },
  hero: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 6,
  },
};

export const gradients = {
  aqua: ['#F7FEFF', '#EAFBFE', '#F9FEFF'],
  deepAqua: ['#66D2E5', '#08AFCB', '#0589A4'],
};

export const layout = {
  maxPhoneWidth: 393,
  maxPhoneHeight: 852,
  tabHeight: 58,
  tabBottom: 10,
};

export const rtl = {
  text: {
    textAlign: 'right' as const,
    writingDirection: 'rtl' as const,
  },
  textCenter: {
    textAlign: 'center' as const,
    writingDirection: 'rtl' as const,
  },
  row: {
    flexDirection: 'row-reverse' as const,
  },
};
