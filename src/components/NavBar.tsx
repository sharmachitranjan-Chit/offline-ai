import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSizes, radius, spacing } from '../theme';

export type TabKey = 'chat' | 'models' | 'settings';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'chat', label: 'Chat', icon: '💬' },
  { key: 'models', label: 'Models', icon: '🧩' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

/**
 * Bottom navigation.
 *
 * The bar sits behind the gesture area and pads itself by the real inset
 * rather than a guessed constant, so it lands correctly on three-button
 * navigation, gesture navigation, and devices with no bottom inset at all.
 * In landscape the labels sit beside the icons to keep the bar short.
 */
export default function NavBar({
  active,
  onChange,
  ready,
  horizontal,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
  ready: boolean;
  horizontal: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}>
      {TABS.map(tab => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            android_ripple={{ color: colors.accentMuted, borderless: false }}>
            <View
              style={[
                horizontal ? styles.innerRow : styles.innerCol,
                isActive && styles.innerActive,
              ]}>
              <Text style={[styles.icon, !isActive && styles.iconIdle]}>
                {tab.icon}
              </Text>
              <Text
                style={[
                  styles.label,
                  horizontal && styles.labelRow,
                  isActive && styles.labelActive,
                ]}>
                {tab.label}
              </Text>
              {tab.key === 'models' && ready && <View style={styles.dot} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center' },
  innerCol: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  innerActive: { backgroundColor: colors.accentSoft },
  icon: { fontSize: 17 },
  iconIdle: { opacity: 0.6 },
  label: {
    fontSize: fontSizes.xxs,
    color: colors.textFaint,
    marginTop: 2,
    fontWeight: '600',
  },
  labelRow: { marginTop: 0, fontSize: fontSizes.xs },
  labelActive: { color: colors.accent },
  dot: {
    position: 'absolute',
    top: 2,
    right: spacing.md,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
});
