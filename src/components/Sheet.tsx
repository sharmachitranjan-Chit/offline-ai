import React, { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from './Icon';
import { makeStyles, useColors } from '../context/ThemeContext';
import { duration, fontSizes, radius, spacing } from '../theme';

/**
 * Bottom sheet.
 *
 * Sheets rather than alerts for anything with more than two choices: they
 * arrive from the edge nearest the thumb, they can hold a description under
 * each option, and dismissing one is a tap anywhere rather than hunting for
 * "Cancel". Built on Modal and Animated so it needs no gesture library.
 */
export default function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  maxHeightRatio = 0.82,
}: {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightRatio?: number;
}) {
  const c = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: visible ? duration.normal : duration.fast,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: slide }]}>
        <Pressable style={styles.backdropPress} onPress={onClose} />
      </Animated.View>

      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + spacing.md,
              maxHeight: `${Math.round(maxHeightRatio * 100)}%`,
              transform: [
                {
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [420, 0],
                  }),
                },
              ],
            },
          ]}>
          <View style={styles.grip} />
          {!!title && (
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{title}</Text>
                {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>
              <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
                <Icon name="close" size={14} color={c.textSecondary} />
              </Pressable>
            </View>
          )}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** One tappable row inside a sheet. */
export function SheetRow({
  icon,
  label,
  detail,
  selected,
  danger,
  disabled,
  onPress,
  right,
}: {
  icon?: IconName;
  label: string;
  detail?: string;
  selected?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const c = useColors();
  const styles = useStyles();
  const tint = danger ? c.danger : selected ? c.accent : c.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}>
      {!!icon && (
        <View style={styles.rowIcon}>
          <Icon name={icon} size={18} color={tint} background={c.surface} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: tint }]} numberOfLines={1}>
          {label}
        </Text>
        {!!detail && (
          <Text style={styles.rowDetail} numberOfLines={3}>
            {detail}
          </Text>
        )}
      </View>
      {right}
      {selected && !right && <Icon name="check" size={16} color={c.accent} />}
    </Pressable>
  );
}

export function SheetSection({ label }: { label: string }) {
  const styles = useStyles();
  return <Text style={styles.section}>{label}</Text>;
}

const useStyles = makeStyles(c => ({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.scrim,
  },
  backdropPress: { flex: 1 },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  grip: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: c.textPrimary, fontSize: fontSizes.lg, fontWeight: '700' },
  subtitle: {
    color: c.textSecondary,
    fontSize: fontSizes.xs,
    lineHeight: 18,
    marginTop: spacing.xxs,
  },
  close: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  rowSelected: { backgroundColor: c.accentSoft },
  rowPressed: { backgroundColor: c.surfaceAlt },
  rowDisabled: { opacity: 0.45 },
  rowIcon: { width: 22, alignItems: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: fontSizes.md, fontWeight: '600' },
  rowDetail: {
    color: c.textSecondary,
    fontSize: fontSizes.xs,
    lineHeight: 17,
    marginTop: 2,
  },
  section: {
    color: c.textFaint,
    fontSize: fontSizes.xxs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
}));
