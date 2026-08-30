import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Attachment } from '../services/attachments';
import { formatBytes } from '../services/modelManager';
import { colors, fontSizes, radius, spacing } from '../theme';

const ICONS: Record<Attachment['kind'], string> = {
  image: '🖼',
  pdf: '📄',
  document: '📝',
  text: '📃',
};

/**
 * Compact preview of one attached file. Images show a thumbnail; anything
 * else shows what was actually extracted, so it's obvious before sending
 * whether the model will have something useful to work with.
 */
export default function AttachmentChip({
  attachment,
  onRemove,
  compactPreview = false,
}: {
  attachment: Attachment;
  onRemove?: () => void;
  compactPreview?: boolean;
}) {
  const { kind, name, size, text, pageCount, previewPath, problem } = attachment;

  const detail = problem
    ? problem
    : kind === 'image'
    ? formatBytes(size)
    : text
    ? `${pageCount ? `${pageCount} pages · ` : ''}${text.length.toLocaleString()} characters read`
    : formatBytes(size);

  return (
    <View style={[styles.chip, problem && styles.chipWarn]}>
      {previewPath ? (
        <Image
          source={{ uri: `file://${previewPath}` }}
          style={compactPreview ? styles.thumbSmall : styles.thumb}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.iconBox}>
          <Text style={styles.icon}>{ICONS[kind]}</Text>
        </View>
      )}

      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text
          style={[styles.detail, problem && styles.detailWarn]}
          numberOfLines={2}>
          {detail}
        </Text>
      </View>

      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={10} style={styles.remove}>
          <Text style={styles.removeText}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    maxWidth: 280,
  },
  chipWarn: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  thumb: { width: 44, height: 44, borderRadius: radius.xs },
  thumbSmall: { width: 32, height: 32, borderRadius: radius.xs },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  meta: { flex: 1, marginLeft: spacing.sm, minWidth: 0 },
  name: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  detail: { color: colors.textSecondary, fontSize: fontSizes.xxs, marginTop: 1 },
  detailWarn: { color: colors.warning },
  remove: { paddingHorizontal: spacing.sm },
  removeText: {
    color: colors.textSecondary,
    fontSize: 22,
    lineHeight: 24,
  },
});
