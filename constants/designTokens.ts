/**
 * Central design tokens — import these across the app and Tailwind config.
 * Reference palette aligns with light cyan primary (#A5E8FD) and Planora-style accents.
 */
export const palette = {
  primary: '#A5E8FD',
  primaryDark: '#2A6174',
  onPrimary: '#163843',
  coral: '#F26B50',
  purple: '#C14EE4',
  black: '#000000',
  white: '#FFFFFF',
  expense: '#EF4444',
} as const;

/** Semantic positive-flow color (readable on light backgrounds). */
export const incomeLight = palette.primaryDark;
/** Positive-flow color on dark backgrounds. */
export const incomeDark = '#8AE2FB';

export const radii = {
  xs: 10,
  sm: 14,
  md: 20,
  lg: 26,
  xl: 32,
  /** Pill / stadium caps */
  pill: 9999,
} as const;

export const typography = {
  screenTitle: { fontSize: 24, fontWeight: '800' as const },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
} as const;

/** Hex + alpha suffix for RN / CSS */
export function withAlpha(hex: string, alphaHex: string): string {
  if (hex.length === 7) return `${hex}${alphaHex}`;
  return hex;
}

/** Vertical bar gradients [top, bottom] — matches reference charts */
export const chartGradients = {
  barDefault: ['#8BDDFA', '#A5E8FD'] as const,
  barActive: ['#2A6174', '#5BC8EA'] as const,
  fab: ['#5BD6FA', '#A5E8FD'] as const,
};
