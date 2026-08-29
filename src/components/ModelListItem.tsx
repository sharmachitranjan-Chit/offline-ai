import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ModelEntry } from '../data/modelCatalog';
import { colors, fontSizes, radius, spacing } from '../theme';
import ProgressBar from './ProgressBar';

type Props = {
  model: ModelEntry;
  isDownloaded: boolean;
  isActive: boolean;
  downloadFraction?: number; // present while downloading
  downloadedBytesLabel?: string;
  onDownload: () => void;
  onCancelDownload: () => void;
  onDelete: () => void;
  onSelect: () => void;
};

export default function ModelListItem({
  model,
  isDownloaded,
  isActive,
  downloadFraction,
  downloadedBytesLabel,
  onDownload,
  onCancelDownload,
  onDelete,
  onSelect,
}: Props) {
  const isDownloading = downloadFraction !== undefined;

  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{model.label}</Text>
          <Text style={styles.subtitle}>
            {model.publisher} · {model.paramCount} · {model.quant}
          </Text>
        </View>
        {isActive ? (
          <View style={styles.activePill}>
            <Text style={styles.activePillText}>Active</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.description}>{model.description}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>~{model.approxSizeGiB} GB download</Text>
        <Text style={styles.metaDot}>•</Text>
        <Text style={styles.metaText}>{model.minRamGiB}+ GB RAM suggested</Text>
        <Text style={styles.metaDot}>•</Text>
        <Text style={styles.metaText}>{model.license}</Text>
      </View>

      {isDownloading ? (
        <View style={styles.downloadingBlock}>
          <ProgressBar fraction={downloadFraction} />
          <View style={styles.downloadingRow}>
            <Text style={styles.metaText}>{downloadedBytesLabel}</Text>
            <Pressable onPress={onCancelDownload}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          {!isDownloaded && (
            <Pressable style={styles.primaryButton} onPress={onDownload}>
              <Text style={styles.primaryButtonText}>Download</Text>
            </Pressable>
          )}
          {isDownloaded && !isActive && (
            <Pressable style={styles.primaryButton} onPress={onSelect}>
              <Text style={styles.primaryButtonText}>Use this model</Text>
            </Pressable>
          )}
          {isDownloaded && (
            <Pressable style={styles.secondaryButton} onPress={onDelete}>
              <Text style={styles.secondaryButtonText}>Delete</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  cardActive: {
    borderColor: colors.accent,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  activePill: {
    backgroundColor: colors.accentMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  activePillText: {
    color: colors.accent,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  description: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
  },
  metaDot: {
    color: colors.textSecondary,
    marginHorizontal: spacing.xs,
    fontSize: fontSizes.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
  },
  primaryButtonText: {
    color: '#0A1830',
    fontWeight: '700',
    fontSize: fontSizes.sm,
  },
  secondaryButton: {
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  secondaryButtonText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: fontSizes.sm,
  },
  downloadingBlock: {
    marginTop: spacing.md,
  },
  downloadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  cancelText: {
    color: colors.danger,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
});
