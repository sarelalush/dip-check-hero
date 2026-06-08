export const colors = {
  background: '#EAF7FA',
  backgroundAlt: '#F8FDFF',
  backgroundDeep: '#06384A',
  surface: '#FFFFFF',
  surfaceSoft: '#F5FCFE',
  card: '#FFFFFF',
  cardSoft: 'rgba(255,255,255,0.92)',
  text: '#062838',
  textSoft: '#21495A',
  muted: '#6F8793',
  subtle: '#E7F6FA',
  subtle2: '#D7EEF5',
  border: '#DCECF1',
  borderStrong: '#C8E0E8',
  primary: '#00A7C8',
  primaryDark: '#007A96',
  primaryDeep: '#075A70',
  primaryLight: '#70DDEA',
  primarySoft: '#DDF8FC',
  navy: '#083344',
  navySoft: '#0D4B5E',
  success: '#13B981',
  successSoft: '#E7F9F1',
  warning: '#F59E0B',
  warningSoft: '#FFF6E3',
  danger: '#EF4444',
  dangerSoft: '#FEECEC',
  white: '#FFFFFF',
  whiteSoft: 'rgba(255,255,255,0.88)',
  whiteMuted: 'rgba(255,255,255,0.68)',
  glass: 'rgba(255,255,255,0.78)',
  blackSoft: 'rgba(6,40,56,0.10)',
  overlay: 'rgba(6,40,56,0.55)',
  tabInactive: '#8EA6B1',
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
    title: 30,
    display: 38,
  },
  lineHeights: {
    body: 24,
    subtitle: 27,
    title: 38,
    display: 46,
  },
};

export const shadows = {
  card: {
    shadowColor: '#052E3B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 5,
  },
  soft: {
    shadowColor: '#052E3B',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  hero: {
    shadowColor: '#005B73',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.22,
    shadowRadius: 36,
    elevation: 9,
  },
  button: {
    shadowColor: '#008BAD',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 7,
  },
  tab: {
    shadowColor: '#042C3B',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 9,
  },
};

export const gradients = {
  aqua: ['#EAFBFF', '#D8F4FA', '#F8FDFF'],
  deepAqua: ['#06384A', '#007A96', '#00A7C8'],
};

export const layout = {
  maxPhoneWidth: 430,
  tabHeight: 86,
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
