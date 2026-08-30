import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

export default function ProgressBar({
  fraction,
  color = colors.accent,
  height = 4,
}: {
  /** 0..1, or a negative number when the total size is unknown. */
  fraction: number;
  color?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const indeterminate = fraction < 0;

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          {
            width: indeterminate ? '35%' : `${clamped * 100}%`,
            backgroundColor: color,
            borderRadius: height / 2,
            opacity: indeterminate ? 0.55 : 1,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
    borderRadius: radius.pill,
  },
  fill: { height: '100%' },
});
