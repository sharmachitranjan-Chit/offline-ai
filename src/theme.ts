import { useWindowDimensions } from 'react-native';

/**
 * Design tokens.
 *
 * Two complete palettes live here — light and dark — and every screen reads
 * its colours through `useTheme()` rather than importing a fixed object.
 * Nothing in the app hard-codes a colour, which is what makes "follow the
 * system" work rather than being a switch that only half the UI obeys.
 */

export type Palette = {
  scheme: 'light' | 'dark';

  background: string;
  /** Cards, sheets, bars. */
  surface: string;
  /** Inputs and chips sitting on `surface`. */
  surfaceAlt: string;
  /** The most raised step — pressed states, secondary buttons. */
  surfaceHigh: string;

  border: string;
  borderSoft: string;

  textPrimary: string;
  textSecondary: string;
  textFaint: string;

  accent: string;
  accentSoft: string;
  accentMuted: string;
  onAccent: string;

  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;

  bubbleUser: string;
  bubbleUserText: string;
  /** Assistant replies are drawn flat, so this is only used for errors. */
  bubbleAssistant: string;

  code: string;
  codeText: string;
  codeBar: string;

  /** Behind modals and the drawer. */
  scrim: string;
  /** Very light wash used for selected rows. */
  highlight: string;
};

export const darkPalette: Palette = {
  scheme: 'dark',

  background: '#0B0D11',
  surface: '#14171E',
  surfaceAlt: '#1C2029',
  surfaceHigh: '#232833',

  border: '#2A303C',
  borderSoft: '#1E232C',

  textPrimary: '#F4F6F8',
  textSecondary: '#98A1AF',
  textFaint: '#5F6875',

  accent: '#6E9BFF',
  accentSoft: '#1B2740',
  accentMuted: '#2E3B57',
  onAccent: '#08101F',

  success: '#3DDC84',
  successSoft: '#12301F',
  danger: '#FF5C60',
  dangerSoft: '#33161A',
  warning: '#F0B24A',
  warningSoft: '#33270F',

  bubbleUser: '#26365C',
  bubbleUserText: '#F4F6F8',
  bubbleAssistant: '#171B23',

  code: '#0A0C10',
  codeText: '#D8E1F0',
  codeBar: '#161A22',

  scrim: 'rgba(0,0,0,0.62)',
  highlight: '#171B23',
};

export const lightPalette: Palette = {
  scheme: 'light',

  background: '#FBFAF9',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F0ED',
  surfaceHigh: '#E6E4DF',

  border: '#DBD8D2',
  borderSoft: '#EAE8E3',

  textPrimary: '#1A1A19',
  textSecondary: '#5B5954',
  textFaint: '#8B8880',

  accent: '#2C5BD8',
  accentSoft: '#E8EEFC',
  accentMuted: '#A8BEF0',
  onAccent: '#FFFFFF',

  success: '#1B8A48',
  successSoft: '#E2F4E9',
  danger: '#C0362E',
  dangerSoft: '#FBE9E7',
  warning: '#9A6608',
  warningSoft: '#FAF0D9',

  bubbleUser: '#E8EEFC',
  bubbleUserText: '#16223B',
  bubbleAssistant: '#FFFFFF',

  code: '#F4F3F0',
  codeText: '#24262B',
  codeBar: '#EAE8E3',

  scrim: 'rgba(20,18,15,0.38)',
  highlight: '#F3F2EF',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
};

export const fontSizes = {
  xxs: 11,
  xs: 12,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
};

export const duration = {
  fast: 140,
  normal: 220,
  slow: 320,
};

export type Layout = {
  width: number;
  height: number;
  /** Phone in portrait — the overwhelmingly common case. */
  compact: boolean;
  /** Large phone in landscape, or a small tablet. */
  medium: boolean;
  /** Tablet or foldable opened out: room for a permanently visible drawer. */
  expanded: boolean;
  landscape: boolean;
  /** Content column width, so text never stretches uncomfortably wide. */
  contentWidth: number;
  /** Max width for a chat bubble. */
  bubbleMaxWidth: number;
  gutter: number;
  drawerWidth: number;
};

/**
 * One hook that every screen reads its geometry from. Layout decisions are
 * driven by the actual width rather than a device-type guess, so split
 * screen, foldables and rotation all behave without special cases.
 */
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const expanded = width >= 900;
  const medium = width >= 600 && width < 900;
  const compact = width < 600;
  const gutter = compact ? spacing.lg : spacing.xl;
  const contentWidth = Math.min(width - gutter * 2, 760);

  return {
    width,
    height,
    compact,
    medium,
    expanded,
    landscape,
    contentWidth,
    bubbleMaxWidth: Math.min(contentWidth * 0.86, 620),
    gutter,
    drawerWidth: Math.min(Math.round(width * 0.84), 340),
  };
}
