import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, spacing } from '../theme';

export type TabKey = 'chat' | 'models';

type Props = {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  modelBadge?: string;
};

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'chat', label: 'Chat', icon: '💬' },
  { key: 'models', label: 'Models', icon: '📦' },
];

export default function TabBar({ active, onChange, modelBadge }: Props) {
  return (
    <View style={styles.container}>
      {TABS.map(tab => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={styles.tab}
            android_ripple={{ color: colors.accentMuted }}
          >
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
            {tab.key === 'models' && modelBadge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{modelBadge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  icon: {
    fontSize: fontSizes.lg,
  },
  label: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  labelActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: '28%',
    backgroundColor: colors.success,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 9,
    color: '#04140B',
    fontWeight: '700',
  },
});
