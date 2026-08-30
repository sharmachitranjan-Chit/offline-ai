import { useWindowDimensions } from 'react-native';

/**
 * Dark by default. A local-model app is closer to a terminal than a social
 * feed, and a dark surface also draws measurably less power on the OLED
 * panels these phones ship with — which matters when generation is already
 * pushing the SoC.
 */
export const colors = {
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
  success: '#3DDC84',
  successSoft: '#12301F',
  danger: '#FF5C60',
  dangerSoft: '#33161A',
  warning: '#F0B24A',
  warningSoft: '#33270F',
  bubbleUser: '#26365C',
  bubbleAssistant: '#171B23',
  onAccent: '#08101F',
  code: '#0A0C10',
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

export type Layout = {
  width: number;
  height: number;
  /** Phone in portrait — the overwhelmingly common case. */
  compact: boolean;
  /** Large phone in landscape, or a small tablet. */
  medium: boolean;
  /** Tablet or foldable opened out: room for a persistent side panel. */
  expanded: boolean;
  landscape: boolean;
  /** Content column width, so text never stretches uncomfortably wide. */
  contentWidth: number;
  /** Max width for a chat bubble. */
  bubbleMaxWidth: number;
  gutter: number;
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
  };
}
