import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  fraction: number; // 0..1
  color?: string;
  height?: number;
};

export default function ProgressBar({ fraction, color, height = 6 }: Props) {
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            backgroundColor: color ?? colors.accent,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
