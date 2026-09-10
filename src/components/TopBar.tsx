import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from './Icon';
import { makeStyles, useColors } from '../context/ThemeContext';
import { fontSizes, radius, spacing } from '../theme';

export type TopBarAction = {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * The bar across the top of every screen.
 *
 * On the chat screen the title is a button: tapping the model name opens the
 * model switcher. That is where people look for it, and it saves a trip
 * through a settings screen just to change model.
 */
export default function TopBar({
  title,
  subtitle,
  leading = 'menu',
  onLeading,
  onTitlePress,
  actions = [],
}: {
  title: string;
  subtitle?: string;
  leading?: 'menu' | 'back' | 'none';
  onLeading?: () => void;
  onTitlePress?: () => void;
  actions?: TopBarAction[];
}) {
  const c = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      {leading !== 'none' && (
        <Pressable
          onPress={onLeading}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          accessibilityLabel={leading === 'menu' ? 'Open chats' : 'Back'}>
          <Icon
            name={leading === 'menu' ? 'menu' : 'chevronLeft'}
            size={leading === 'menu' ? 18 : 20}
            color={c.textPrimary}
          />
        </Pressable>
      )}

      <Pressable
        style={styles.titleWrap}
        onPress={onTitlePress}
        disabled={!onTitlePress}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {!!onTitlePress && (
            <Icon name="chevronDown" size={12} color={c.textSecondary} />
          )}
        </View>
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </Pressable>

      <View style={styles.actions}>
        {actions.map(a => (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            disabled={a.disabled}
            hitSlop={10}
            accessibilityLabel={a.label}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.pressed,
              a.disabled && styles.disabled,
            ]}>
            <Icon name={a.icon} size={17} color={c.textPrimary} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: c.background,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: c.surfaceAlt },
  disabled: { opacity: 0.4 },
  titleWrap: { flex: 1, minWidth: 0, paddingHorizontal: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: {
    color: c.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: '700',
    flexShrink: 1,
  },
  subtitle: { color: c.textFaint, fontSize: fontSizes.xxs, marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center' },
}));
