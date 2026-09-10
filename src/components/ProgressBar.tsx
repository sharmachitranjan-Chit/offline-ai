import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useColors } from '../context/ThemeContext';
import { radius } from '../theme';

export default function ProgressBar({
  fraction,
  color,
  height = 4,
  animated = true,
}: {
  /** 0..1, or a negative number when the total size is unknown. */
  fraction: number;
  color?: string;
  height?: number;
  animated?: boolean;
}) {
  const c = useColors();
  const clamped = Math.max(0, Math.min(1, fraction));
  const indeterminate = fraction < 0;

  const width = useRef(new Animated.Value(clamped)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (indeterminate || !animated) {
      width.setValue(clamped);
      return;
    }
    // Bytes arrive in bursts; easing the bar makes a stuttering transfer
    // read as steady progress rather than a broken widget.
    Animated.timing(width, {
      toValue: clamped,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [clamped, indeterminate, animated, width]);

  useEffect(() => {
    if (!indeterminate) return;
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [indeterminate, sweep]);

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: c.surfaceHigh },
      ]}>
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color ?? c.accent,
            borderRadius: height / 2,
            opacity: indeterminate ? 0.6 : 1,
            width: indeterminate
              ? '35%'
              : width.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
            left: indeterminate
              ? sweep.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['-35%', '100%'],
                })
              : 0,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: radius.pill,
  },
  fill: { height: '100%', position: 'absolute', top: 0 },
});
