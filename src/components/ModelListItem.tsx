import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ModelEntry,
  TAG_LABELS,
  getMmprojDownloadUrl,
  getModelDownloadUrl,
  getRepoPageUrl,
  totalSizeGiB,
} from '../data/modelCatalog';
import { DownloadStatus, formatBytes } from '../services/modelManager';
import { DocKit } from '../native/DocKit';
import ProgressBar from './ProgressBar';
import { colors, fontSizes, radius, spacing } from '../theme';

type Props = {
  model: ModelEntry;
  installed: boolean;
  active: boolean;
  /** Live status per file, when a transfer is running. */
  status?: { model?: DownloadStatus; mmproj?: DownloadStatus };
  /** Device RAM in GiB, used to flag models that won't fit. */
  deviceRamGiB?: number;
  onDownload: () => void;
  onPause: () => void;
  onCancel: () => void;
  onLoad: () => void;
  onDelete: () => void;
};

export default function ModelListItem({
  model,
  installed,
  active,
  status,
  deviceRamGiB,
  onDownload,
  onPause,
  onCancel,
  onLoad,
  onDelete,
}: Props) {
  const [showLinks, setShowLinks] = useState(false);

  const running = status?.model?.state === 'running' || status?.mmproj?.state === 'running';
  const paused = status?.model?.state === 'paused' || status?.mmproj?.state === 'paused';
  const failed = status?.model?.state === 'error' || status?.mmproj?.state === 'error';
  const errorMessage = status?.model?.message ?? status?.mmproj?.message;

  const live = status?.mmproj?.state === 'running' ? status.mmproj : status?.model;
  const fraction = live && live.total > 0 ? live.written / live.total : -1;

  const tooBig = deviceRamGiB !== undefined && model.minRamGiB > deviceRamGiB;

  const modelUrl = getModelDownloadUrl(model);
  const mmprojUrl = getMmprojDownloadUrl(model);

  return (
    <View style={[styles.card, active && styles.cardActive]}>
      <View style={styles.headerRow}>
        <View style={styles.titleBox}>
          <Text style={styles.title}>{model.label}</Text>
          <Text style={styles.sub}>
            {model.publisher} · {model.paramCount} · {model.quant} ·{' '}
            {totalSizeGiB(model).toFixed(1)} GB
          </Text>
        </View>
        {active && (
          <View style={styles.activePill}>
            <Text style={styles.activePillText}>Loaded</Text>
          </View>
        )}
      </View>

      {!!model.tags.length && (
        <View style={styles.tags}>
          {model.tags.map(t => (
            <View
              key={t}
              style={[
                styles.tag,
                t === 'recommended' && styles.tagAccent,
                t === 'uncensored' && styles.tagWarn,
                t === 'vision' && styles.tagSuccess,
              ]}>
              <Text
                style={[
                  styles.tagText,
                  t === 'recommended' && styles.tagTextAccent,
                  t === 'uncensored' && styles.tagTextWarn,
                  t === 'vision' && styles.tagTextSuccess,
                ]}>
                {TAG_LABELS[t]}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.description}>{model.description}</Text>

      {tooBig && (
        <Text style={styles.warn}>
          Wants about {model.minRamGiB} GB of RAM; this device reports{' '}
          {deviceRamGiB?.toFixed(1)} GB. It may load very slowly or be killed
          by the system.
        </Text>
      )}

      {model.mmproj && (
        <Text style={styles.note}>
          Two files: the model plus a {model.mmproj.approxSizeGiB.toFixed(2)} GB
          vision projector. Both are needed before images work.
        </Text>
      )}

      {(running || paused) && (
        <View style={styles.progressBox}>
          <ProgressBar fraction={fraction} />
          <Text style={styles.progressText}>
            {live
              ? `${live.part === 'mmproj' ? 'Projector' : 'Model'} · ${formatBytes(
                  live.written,
                )}${live.total > 0 ? ` of ${formatBytes(live.total)}` : ''}`
              : 'Starting…'}
            {paused ? ' · paused' : ''}
          </Text>
        </View>
      )}

      {failed && !!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <View style={styles.actions}>
        {installed ? (
          <>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={onLoad}
              disabled={active}>
              <Text style={styles.btnPrimaryText}>
                {active ? 'In use' : 'Load'}
              </Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={onDelete}>
              <Text style={styles.btnDangerText}>Delete</Text>
            </Pressable>
          </>
        ) : running ? (
          <>
            <Pressable style={styles.btn} onPress={onPause}>
              <Text style={styles.btnText}>Pause</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={onCancel}>
              <Text style={styles.btnDangerText}>Cancel</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onDownload}>
              <Text style={styles.btnPrimaryText}>
                {paused || failed ? 'Resume' : 'Download'}
              </Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => setShowLinks(v => !v)}>
              <Text style={styles.btnText}>
                {showLinks ? 'Hide links' : 'Get link'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {showLinks && (
        <View style={styles.links}>
          <Text style={styles.linksIntro}>
            Prefer your own download manager or browser? Take the file
            yourself, save it to Downloads, then use “Import from storage” at
            the top of this screen. Nothing here has to go through the app.
          </Text>

          <LinkRow label="Model file" url={modelUrl} />
          {mmprojUrl && <LinkRow label="Vision projector" url={mmprojUrl} />}
          <LinkRow label="All files in this repo" url={getRepoPageUrl(model)} />
        </View>
      )}
    </View>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <View style={styles.linkRow}>
      <Text style={styles.linkLabel}>{label}</Text>
      <Text style={styles.linkUrl} numberOfLines={2} selectable>
        {url}
      </Text>
      <View style={styles.linkActions}>
        <Pressable
          hitSlop={8}
          onPress={() => {
            DocKit.setClipboard(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}>
          <Text style={styles.linkAction}>{copied ? 'Copied' : 'Copy'}</Text>
        </Pressable>
        <Pressable hitSlop={8} onPress={() => DocKit.openUrl(url)}>
          <Text style={styles.linkAction}>Open in browser</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardActive: { borderColor: colors.accent },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  titleBox: { flex: 1 },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  sub: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 2 },
  activePill: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  activePillText: {
    color: colors.success,
    fontSize: fontSizes.xxs,
    fontWeight: '700',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm, gap: 6 },
  tag: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  tagAccent: { backgroundColor: colors.accentSoft },
  tagWarn: { backgroundColor: colors.warningSoft },
  tagSuccess: { backgroundColor: colors.successSoft },
  tagText: { color: colors.textSecondary, fontSize: fontSizes.xxs, fontWeight: '600' },
  tagTextAccent: { color: colors.accent },
  tagTextWarn: { color: colors.warning },
  tagTextSuccess: { color: colors.success },
  description: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  note: {
    color: colors.textFaint,
    fontSize: fontSizes.xs,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  warn: {
    color: colors.warning,
    fontSize: fontSizes.xs,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: fontSizes.xs,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  progressBox: { marginTop: spacing.md },
  progressText: {
    color: colors.textFaint,
    fontSize: fontSizes.xxs,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  btn: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceHigh,
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnText: { color: colors.textPrimary, fontSize: fontSizes.sm, fontWeight: '600' },
  btnPrimaryText: { color: colors.onAccent, fontSize: fontSizes.sm, fontWeight: '700' },
  btnDangerText: { color: colors.danger, fontSize: fontSizes.sm, fontWeight: '600' },
  links: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  linksIntro: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  linkRow: { marginBottom: spacing.md },
  linkLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.xs,
    fontWeight: '700',
    marginBottom: 2,
  },
  linkUrl: {
    color: colors.accent,
    fontSize: fontSizes.xxs,
    lineHeight: 16,
    fontFamily: 'monospace',
  },
  linkActions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  linkAction: { color: colors.textSecondary, fontSize: fontSizes.xs, fontWeight: '600' },
});
