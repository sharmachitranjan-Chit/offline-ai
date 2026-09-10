import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Icon, { IconName } from './Icon';
import { Attachment } from '../services/attachments';
import { formatBytes } from '../services/modelManager';
import { makeStyles, useColors } from '../context/ThemeContext';
import { fontSizes, radius, spacing } from '../theme';

const ICONS: Record<Attachment['kind'], IconName> = {
  image: 'image',
  pdf: 'file',
  document: 'file',
  text: 'file',
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
  const c = useColors();
  const styles = useStyles();
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
          <Icon
            name={ICONS[kind]}
            size={18}
            color={problem ? c.warning : c.textSecondary}
          />
        </View>
      )}

      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.detail, problem && styles.detailWarn]} numberOfLines={2}>
          {detail}
        </Text>
      </View>

      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={10} style={styles.remove}>
          <Icon name="close" size={12} color={c.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

const useStyles = makeStyles(c => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    maxWidth: 280,
  },
  chipWarn: {
    borderColor: c.warning,
    backgroundColor: c.warningSoft,
  },
  thumb: { width: 44, height: 44, borderRadius: radius.xs },
  thumbSmall: { width: 32, height: 32, borderRadius: radius.xs },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.xs,
    backgroundColor: c.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  meta: { flex: 1, marginLeft: spacing.sm, minWidth: 0 },
  name: {
    color: c.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  detail: { color: c.textSecondary, fontSize: fontSizes.xxs, marginTop: 1 },
  detailWarn: { color: c.warning },
  remove: { paddingHorizontal: spacing.sm },
}));
