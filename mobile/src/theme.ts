export const colors = {
  background: '#EEF9FC',
  backgroundAlt: '#F7FDFF',
  backgroundDeep: '#083344',
  card: '#FFFFFF',
  cardSoft: 'rgba(255,255,255,0.86)',
  text: '#0F2633',
  textSoft: '#27485A',
  muted: '#6A8391',
  subtle: '#E6F6FB',
  subtle2: '#D8F0F7',
  border: '#D7EAF1',
  primary: '#06A8C7',
  primaryDark: '#087A99',
  primaryDeep: '#0B5970',
  primaryLight: '#74DDED',
  primarySoft: '#DDF7FC',
  success: '#10B981',
  successSoft: '#E9FBF3',
  warning: '#F59E0B',
  warningSoft: '#FFF7E6',
  danger: '#EF4444',
  dangerSoft: '#FEECEC',
  white: '#FFFFFF',
  whiteSoft: 'rgba(255,255,255,0.82)',
  whiteMuted: 'rgba(255,255,255,0.68)',
  glass: 'rgba(255,255,255,0.74)',
  blackSoft: 'rgba(15,32,51,0.10)',
  tabInactive: '#8AA1AD',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  xxl: 40,
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
  brandSpacing: 2.6,
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
    shadowColor: '#0F2840',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 4,
  },
  soft: {
    shadowColor: '#0F2840',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  hero: {
    shadowColor: '#005B73',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 8,
  },
  button: {
    shadowColor: '#0092B3',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 6,
  },
  tab: {
    shadowColor: '#083344',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
    elevation: 7,
  },
};

export const gradients = {
  aqua: ['#E9FBFF', '#D7F3FB', '#F7FDFF'],
  deepAqua: ['#0A6F87', '#06A8C7', '#73E0EE'],
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