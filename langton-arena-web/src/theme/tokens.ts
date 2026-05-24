// src/theme/tokens.ts
//
// 6 тем со всеми семантическими токенами.
// Соответствие: docs/interface-contract.md §9.

export interface ThemeTokens {
  // Surfaces
  bg: string;
  bgElevated: string;
  bgOverlay: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;

  // Borders
  border: string;
  borderStrong: string;
  borderFocus: string;

  // Accent
  accent: string;
  accentHover: string;
  accentMuted: string;

  // States
  success: string;
  warning: string;
  danger: string;
  info: string;

  // Radii
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  radiusFull: number;

  // Spacing (8pt grid)
  space1: number;
  space2: number;
  space3: number;
  space4: number;
  space6: number;
  space8: number;
}

const dark: ThemeTokens = {
  bg:             '#0E0B1F',
  bgElevated:     '#16122A',
  bgOverlay:      'rgba(255,255,255,.04)',
  textPrimary:    '#F5F5F7',
  textSecondary:  '#C7C5D8',
  textMuted:      '#8E8E93',
  textDim:        '#5A5870',
  border:         'rgba(255,255,255,.08)',
  borderStrong:   'rgba(255,255,255,.16)',
  borderFocus:    '#FFD60A',
  accent:         '#FFD60A',
  accentHover:    '#FFE143',
  accentMuted:    'rgba(255,214,10,.15)',
  success:        '#39D98A',
  warning:        '#FF8A3D',
  danger:         '#FF453A',
  info:           '#4DA8FF',
  radiusSm: 6, radiusMd: 10, radiusLg: 16, radiusFull: 9999,
  space1: 4, space2: 8, space3: 12, space4: 16, space6: 24, space8: 32,
};

const light: ThemeTokens = {
  bg:             '#F7F7FA',
  bgElevated:     '#FFFFFF',
  bgOverlay:      'rgba(0,0,0,.04)',
  textPrimary:    '#0E0B1F',
  textSecondary:  '#3A3550',
  textMuted:      '#6E6B82',
  textDim:        '#A0A0AB',
  border:         'rgba(0,0,0,.10)',
  borderStrong:   'rgba(0,0,0,.20)',
  borderFocus:    '#FFB800',
  accent:         '#FFB800',
  accentHover:    '#FFA000',
  accentMuted:    'rgba(255,184,0,.18)',
  success:        '#0A8A4A',
  warning:        '#E0701A',
  danger:         '#D02020',
  info:           '#2A6EE0',
  radiusSm: 6, radiusMd: 10, radiusLg: 16, radiusFull: 9999,
  space1: 4, space2: 8, space3: 12, space4: 16, space6: 24, space8: 32,
};

const highContrast: ThemeTokens = {
  ...dark,
  bg:             '#000000',
  textPrimary:    '#FFFFFF',
  textSecondary:  '#FFFFFF',
  textMuted:      '#CCCCCC',
  textDim:        '#888888',
  border:         '#FFFFFF',
  accent:         '#FFFF00',
};

export const THEME_TOKENS: Readonly<Record<string, ThemeTokens>> = {
  dark, light, highContrast,
};

export type ThemeId = keyof typeof THEME_TOKENS;
