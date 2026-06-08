export const colors = {
  background: '#F5FBFF',
  backgroundDeep: '#155E75',
  card: '#FFFFFF',
  text: '#102033',
  muted: '#66788A',
  subtle: '#EAF6FC',
  border: '#D9EAF3',
  primary: '#0891B2',
  primaryDark: '#0E7490',
  primaryLight: '#67D3E8',
  primarySoft: '#DFF7FD',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  white: '#FFFFFF',
  whiteSoft: 'rgba(255,255,255,0.82)',
  whiteMuted: 'rgba(255,255,255,0.68)',
  blackSoft: 'rgba(15,32,51,0.10)',
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
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  round: 999,
};

export const typography = {
  fontFamily: 'System',
  brandSpacing: 2.6,
  sizes: {
    caption: 12,
    body: 16,
    subtitle: 18,
    title: 34,
    display: 41,
  },
  lineHeights: {
    body: 25,
    subtitle: 26,
    title: 42,
    display: 49,
  },
};

export const shadows = {
  card: {
    shadowColor: '#0F2840',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  hero: {
    shadowColor: '#001B2D',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 5,
  },
  button: {
    shadowColor: '#006E8F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
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
