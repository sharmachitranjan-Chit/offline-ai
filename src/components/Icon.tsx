import React from 'react';
import { View, ViewStyle } from 'react-native';

/**
 * A tiny hand-drawn icon set.
 *
 * Every icon is a handful of absolutely positioned rectangles and circles
 * inside a square box, sized in percentages so one component covers every
 * size the UI asks for. Two reasons for doing it this way rather than
 * shipping an icon library:
 *
 *   - Emoji (what this app used before) render differently on every OEM
 *     skin and always look pasted-on next to real UI.
 *   - An SVG or icon-font package is another native dependency in a build
 *     that has to keep working on CI, for a couple of dozen glyphs.
 *
 * Shapes are deliberately simple: strokes are rectangles, circles are
 * bordered views, arrows are two rotated strokes.
 */

export type IconName =
  | 'menu'
  | 'plus'
  | 'minus'
  | 'close'
  | 'check'
  | 'arrowUp'
  | 'arrowDown'
  | 'stop'
  | 'pause'
  | 'play'
  | 'copy'
  | 'trash'
  | 'edit'
  | 'compose'
  | 'retry'
  | 'search'
  | 'chevronDown'
  | 'chevronRight'
  | 'chevronLeft'
  | 'download'
  | 'sliders'
  | 'chip'
  | 'image'
  | 'file'
  | 'folder'
  | 'sun'
  | 'moon'
  | 'phone'
  | 'more'
  | 'dot'
  | 'storage'
  | 'eye'
  | 'info'
  | 'link'
  | 'chat';

type Part = {
  /** All values are percentages of the icon box. */
  l: number;
  t: number;
  w: number;
  h: number;
  /** Degrees. */
  r?: number;
  /** Corner radius as a percentage of the box. */
  rad?: number;
  /** Draw as an outline instead of a filled shape. */
  outline?: boolean;
  /** Use the background colour instead of the icon colour (for crescents). */
  bg?: boolean;
  /** Opacity multiplier. */
  o?: number;
};

const S = 12; // stroke thickness, in percent of the box

const ICONS: Record<IconName, Part[]> = {
  menu: [
    { l: 8, t: 22, w: 84, h: S },
    { l: 8, t: 44, w: 84, h: S },
    { l: 8, t: 66, w: 84, h: S },
  ],
  plus: [
    { l: 10, t: 44, w: 80, h: S, rad: 6 },
    { l: 44, t: 10, w: S, h: 80, rad: 6 },
  ],
  minus: [{ l: 12, t: 44, w: 76, h: S, rad: 6 }],
  close: [
    { l: 6, t: 44, w: 88, h: S, r: 45, rad: 6 },
    { l: 6, t: 44, w: 88, h: S, r: -45, rad: 6 },
  ],
  check: [
    { l: 10, t: 56, w: 40, h: S, r: 45, rad: 6 },
    { l: 30, t: 44, w: 64, h: S, r: -45, rad: 6 },
  ],
  arrowUp: [
    { l: 44, t: 12, w: S, h: 76, rad: 6 },
    { l: 16, t: 26, w: 46, h: S, r: -45, rad: 6 },
    { l: 38, t: 26, w: 46, h: S, r: 45, rad: 6 },
  ],
  arrowDown: [
    { l: 44, t: 12, w: S, h: 76, rad: 6 },
    { l: 16, t: 62, w: 46, h: S, r: 45, rad: 6 },
    { l: 38, t: 62, w: 46, h: S, r: -45, rad: 6 },
  ],
  stop: [{ l: 22, t: 22, w: 56, h: 56, rad: 12 }],
  pause: [
    { l: 24, t: 18, w: 16, h: 64, rad: 6 },
    { l: 60, t: 18, w: 16, h: 64, rad: 6 },
  ],
  play: [
    { l: 30, t: 22, w: 14, h: 44, r: 30, rad: 6 },
    { l: 30, t: 56, w: 14, h: 44, r: -30, rad: 6 },
    { l: 30, t: 22, w: 14, h: 56, rad: 6 },
  ],
  copy: [
    { l: 8, t: 8, w: 56, h: 56, rad: 12, outline: true, o: 0.65 },
    { l: 36, t: 36, w: 56, h: 56, rad: 12, outline: true },
  ],
  trash: [
    { l: 10, t: 20, w: 80, h: S, rad: 6 },
    { l: 36, t: 8, w: 28, h: S, rad: 6 },
    { l: 18, t: 30, w: 64, h: 62, rad: 12, outline: true },
  ],
  edit: [
    { l: 12, t: 62, w: 76, h: S, r: -45, rad: 6 },
    { l: 68, t: 14, w: 22, h: S, r: -45, rad: 6 },
    { l: 8, t: 82, w: 14, h: 14, rad: 7 },
  ],
  compose: [
    { l: 8, t: 20, w: 58, h: 72, rad: 14, outline: true },
    { l: 40, t: 34, w: 60, h: S, r: -45, rad: 6 },
  ],
  retry: [
    { l: 12, t: 12, w: 76, h: 76, rad: 38, outline: true },
    { l: 56, t: 2, w: 34, h: 22, bg: true },
    { l: 60, t: 4, w: 30, h: S, rad: 6 },
    { l: 78, t: 0, w: S, h: 30, rad: 6 },
  ],
  search: [
    { l: 8, t: 8, w: 62, h: 62, rad: 31, outline: true },
    { l: 58, t: 76, w: 36, h: S, r: 45, rad: 6 },
  ],
  chevronDown: [
    { l: 14, t: 38, w: 48, h: S, r: 45, rad: 6 },
    { l: 38, t: 38, w: 48, h: S, r: -45, rad: 6 },
  ],
  chevronRight: [
    { l: 38, t: 14, w: S, h: 48, r: -45, rad: 6 },
    { l: 38, t: 38, w: S, h: 48, r: 45, rad: 6 },
  ],
  chevronLeft: [
    { l: 50, t: 14, w: S, h: 48, r: 45, rad: 6 },
    { l: 50, t: 38, w: S, h: 48, r: -45, rad: 6 },
  ],
  download: [
    { l: 44, t: 6, w: S, h: 56, rad: 6 },
    { l: 20, t: 44, w: 40, h: S, r: 45, rad: 6 },
    { l: 40, t: 44, w: 40, h: S, r: -45, rad: 6 },
    { l: 12, t: 82, w: 76, h: S, rad: 6 },
  ],
  sliders: [
    { l: 8, t: 20, w: 84, h: S, rad: 6, o: 0.75 },
    { l: 8, t: 68, w: 84, h: S, rad: 6, o: 0.75 },
    { l: 58, t: 12, w: 22, h: 22, rad: 11 },
    { l: 24, t: 60, w: 22, h: 22, rad: 11 },
  ],
  chip: [
    { l: 22, t: 22, w: 56, h: 56, rad: 12, outline: true },
    { l: 40, t: 4, w: 8, h: 14, rad: 4 },
    { l: 56, t: 4, w: 8, h: 14, rad: 4 },
    { l: 40, t: 82, w: 8, h: 14, rad: 4 },
    { l: 56, t: 82, w: 8, h: 14, rad: 4 },
    { l: 4, t: 40, w: 14, h: 8, rad: 4 },
    { l: 4, t: 56, w: 14, h: 8, rad: 4 },
    { l: 82, t: 40, w: 14, h: 8, rad: 4 },
    { l: 82, t: 56, w: 14, h: 8, rad: 4 },
  ],
  image: [
    { l: 8, t: 14, w: 84, h: 72, rad: 14, outline: true },
    { l: 26, t: 30, w: 16, h: 16, rad: 8 },
    { l: 22, t: 62, w: 44, h: S, r: -35, rad: 6 },
    { l: 52, t: 60, w: 34, h: S, r: 32, rad: 6 },
  ],
  file: [
    { l: 16, t: 6, w: 68, h: 88, rad: 12, outline: true },
    { l: 30, t: 40, w: 40, h: 8, rad: 4 },
    { l: 30, t: 58, w: 40, h: 8, rad: 4 },
  ],
  folder: [
    { l: 6, t: 26, w: 88, h: 62, rad: 12, outline: true },
    { l: 6, t: 14, w: 40, h: 16, rad: 6 },
  ],
  sun: [
    { l: 30, t: 30, w: 40, h: 40, rad: 20 },
    { l: 44, t: 2, w: S, h: 16, rad: 6 },
    { l: 44, t: 82, w: S, h: 16, rad: 6 },
    { l: 2, t: 44, w: 16, h: S, rad: 6 },
    { l: 82, t: 44, w: 16, h: S, rad: 6 },
    { l: 12, t: 12, w: 16, h: S, r: 45, rad: 6 },
    { l: 72, t: 72, w: 16, h: S, r: 45, rad: 6 },
    { l: 12, t: 72, w: 16, h: S, r: -45, rad: 6 },
    { l: 72, t: 12, w: 16, h: S, r: -45, rad: 6 },
  ],
  moon: [
    { l: 10, t: 10, w: 80, h: 80, rad: 40 },
    { l: 40, t: -6, w: 74, h: 74, rad: 37, bg: true },
  ],
  phone: [
    { l: 24, t: 6, w: 52, h: 88, rad: 14, outline: true },
    { l: 42, t: 78, w: 16, h: 8, rad: 4 },
  ],
  more: [
    { l: 8, t: 42, w: 16, h: 16, rad: 8 },
    { l: 42, t: 42, w: 16, h: 16, rad: 8 },
    { l: 76, t: 42, w: 16, h: 16, rad: 8 },
  ],
  dot: [{ l: 30, t: 30, w: 40, h: 40, rad: 20 }],
  storage: [
    { l: 8, t: 12, w: 84, h: 24, rad: 10, outline: true },
    { l: 8, t: 44, w: 84, h: 24, rad: 10, outline: true },
    { l: 22, t: 78, w: 56, h: S, rad: 6 },
  ],
  eye: [
    { l: 4, t: 26, w: 92, h: 48, rad: 24, outline: true },
    { l: 36, t: 36, w: 28, h: 28, rad: 14 },
  ],
  info: [
    { l: 8, t: 8, w: 84, h: 84, rad: 42, outline: true },
    { l: 44, t: 24, w: S, h: 12, rad: 6 },
    { l: 44, t: 44, w: S, h: 32, rad: 6 },
  ],
  link: [
    { l: 4, t: 44, w: 48, h: 22, rad: 11, outline: true },
    { l: 48, t: 44, w: 48, h: 22, rad: 11, outline: true },
    { l: 34, t: 51, w: 32, h: 8, rad: 4 },
  ],
  chat: [
    { l: 6, t: 12, w: 88, h: 64, rad: 16, outline: true },
    { l: 22, t: 68, w: 22, h: 22, r: 45, rad: 4 },
  ],
};

export default function Icon({
  name,
  size = 20,
  color = '#FFFFFF',
  background = 'transparent',
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  /** Needed by icons that cut a shape out of themselves, like the moon. */
  background?: string;
  style?: ViewStyle;
}) {
  const parts = ICONS[name];
  const px = (v: number) => (v / 100) * size;

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={false}
      pointerEvents="none">
      {parts.map((p, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: px(p.l),
            top: px(p.t),
            width: px(p.w),
            height: px(p.h),
            borderRadius: p.rad ? px(p.rad) : 0,
            opacity: p.o ?? 1,
            transform: p.r ? [{ rotate: `${p.r}deg` }] : undefined,
            ...(p.outline
              ? {
                  borderWidth: Math.max(1, px(S * 0.85)),
                  borderColor: p.bg ? background : color,
                }
              : { backgroundColor: p.bg ? background : color }),
          }}
        />
      ))}
    </View>
  );
}
