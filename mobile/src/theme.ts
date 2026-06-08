export const colors = {
  background: '#EAF9FC',
  backgroundAlt: '#F5FCFE',
  backgroundDeep: '#DFF5FA',
  surface: '#FFFFFF',
  surfaceSoft: '#F7FDFF',
  card: '#FFFFFF',
  cardSoft: 'rgba(255,255,255,0.94)',
  text: '#072A3A',
  textSoft: '#28556A',
  muted: '#78909C',
  subtle: '#E6F7FB',
  subtle2: '#CFEFF6',
  border: '#D9EDF3',
  borderStrong: '#BFE0EA',
  primary: '#06A8CD',
  primaryDark: '#008CB0',
  primaryDeep: '#08708A',
  primaryLight: '#5FCBE1',
  primarySoft: '#DDF7FC',
  navy: '#0B3445',
  navySoft: '#28556A',
  success: '#18B981',
  successSoft: '#E9F9F2',
  warning: '#F59E0B',
  warningSoft: '#FFF5D8',
  danger: '#EF4444',
  dangerSoft: '#FFF0F1',
  white: '#FFFFFF',
  whiteSoft: 'rgba(255,255,255,0.9)',
  whiteMuted: 'rgba(255,255,255,0.72)',
  glass: 'rgba(255,255,255,0.82)',
  blackSoft: 'rgba(7,42,58,0.09)',
  overlay: 'rgba(7,42,58,0.45)',
  tabInactive: '#8AA3AF',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  xxl: 42,
};

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  xxl: 36,
  round: 999,
};

export const typography = {
  fontFamily: 'System',
  brandSpacing: 2.4,
  sizes: {
    caption: 12,
    small: 13,
    body: 16,
    subtitle: 18,
    title: 28,
    display: 34,
  },
  lineHeights: {
    body: 24,
    subtitle: 27,
    title: 36,
    display: 42,
  },
};

export const shadows = {
  card: {
    shadowColor: '#0A5367',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  soft: {
    shadowColor: '#0A5367',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  hero: {
    shadowColor: '#0A5367',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.10,
    shadowRadius: 30,
    elevation: 6,
  },
  button: {
    shadowColor: '#0098BA',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 6,
  },
  tab: {
    shadowColor: '#0A5367',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 8,
  },
};

export const gradients = {
  aqua: ['#F5FDFF', '#EAF9FC', '#F8FDFF'],
  deepAqua: ['#5FCBE1', '#06A8CD', '#008CB0'],
};

export const layout = {
  maxPhoneWidth: 430,
  tabHeight: 76,
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
