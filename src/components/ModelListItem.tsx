import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Icon from './Icon';
import ProgressBar from './ProgressBar';
import Sheet, { SheetRow, SheetSection } from './Sheet';
import {
  ModelEntry,
  TAG_LABELS,
  downloadUrl,
  getRepoPageUrl,
  projectorById,
  quantById,
  totalBytes,
} from '../data/modelCatalog';
import { DownloadStatus, formatBytes } from '../services/modelManager';
import { DocKit } from '../native/DocKit';
import { makeStyles, useColors } from '../context/ThemeContext';
import { fontSizes, radius, spacing } from '../theme';

export type ModelChoice = { quantId?: string; projectorId?: string };

/**
 * One catalog entry.
 *
 * Three things this card insists on showing, because each of them is a
 * question people actually have before committing to a multi-gigabyte
 * download: what it will cost in storage, whether this phone has the memory
 * to run it, and where the file comes from — the direct link is always one
 * tap away, so nobody is forced through the in-app downloader.
 */
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
  onNotify,
}: {
  model: ModelEntry;
  installed: boolean;
  active: boolean;
  status: { model?: DownloadStatus; mmproj?: DownloadStatus };
  deviceRamGiB?: number;
  onDownload: (choice: ModelChoice) => void;
  onPause: () => void;
  onCancel: () => void;
  onLoad: () => void;
  onDelete: () => void;
  onNotify: (message: string) => void;
}) {
  const c = useColors();
  const styles = useStyles();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [quantId, setQuantId] = useState(model.quants[0].id);
  const [projectorId, setProjectorId] = useState(model.mmproj?.[0]?.id);

  const quant = quantById(model, quantId);
  const projector = projectorById(model, projectorId);
  const size = totalBytes(model, quantId, projectorId);

  const live = status.mmproj ?? status.model;
  const running = live?.state === 'running';
  const paused = live?.state === 'paused';
  const failed = live?.state === 'error';
  const fraction = live && live.total > 0 ? live.written / live.total : -1;

  const tooBig = deviceRamGiB !== undefined && deviceRamGiB + 0.4 < model.minRamGiB;
  const tight =
    !tooBig && deviceRamGiB !== undefined && deviceRamGiB < model.minRamGiB + 1.5;

  const tags = useMemo(
    () => model.tags.filter(t => t !== 'recommended'),
    [model.tags],
  );

  const copy = (label: string, url: string) => {
    DocKit.setClipboard(url);
    onNotify(`${label} link copied.`);
  };

  return (
    <View style={[styles.card, active && styles.cardActive]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {model.label}
            </Text>
            {model.tags.includes('recommended') && (
              <View style={styles.star}>
                <Text style={styles.starText}>Recommended</Text>
              </View>
            )}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {model.publisher} · {model.paramCount} · {formatBytes(size)}
            {model.mmproj ? ' incl. projector' : ''}
          </Text>
        </View>
        {installed && (
          <View style={styles.installedPill}>
            <Icon name="check" size={11} color={c.success} />
            <Text style={styles.installedText}>Installed</Text>
          </View>
        )}
      </View>

      <Text style={styles.description}>{model.description}</Text>

      {(tags.length > 0 || tooBig || tight) && (
        <View style={styles.tags}>
          {tags.map(t => (
            <View key={t} style={styles.tag}>
              <Text style={styles.tagText}>{TAG_LABELS[t]}</Text>
            </View>
          ))}
          {tooBig && (
            <View style={[styles.tag, styles.tagDanger]}>
              <Text style={[styles.tagText, styles.tagDangerText]}>
                Needs ~{model.minRamGiB} GB RAM
              </Text>
            </View>
          )}
          {tight && (
            <View style={[styles.tag, styles.tagWarn]}>
              <Text style={[styles.tagText, styles.tagWarnText]}>
                Tight on this phone
              </Text>
            </View>
          )}
        </View>
      )}

      {(running || paused || failed) && (
        <View style={styles.progress}>
          <ProgressBar
            fraction={fraction}
            color={failed ? c.danger : paused ? c.warning : c.accent}
          />
          <Text style={styles.progressText}>
            {failed
              ? live?.message ?? 'Download failed.'
              : paused
              ? 'Paused — tap Resume to carry on from here.'
              : `${formatBytes(live?.written ?? 0)}${
                  live && live.total > 0 ? ` of ${formatBytes(live.total)}` : ''
                }${live?.part === 'mmproj' ? ' · vision projector' : ''}`}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        {installed ? (
          <>
            <Pressable
              style={[styles.btn, styles.btnPrimary, active && styles.btnGhost]}
              onPress={onLoad}
              disabled={active}>
              <Text style={[styles.btnPrimaryText, active && styles.btnGhostText]}>
                {active ? 'Loaded' : 'Load'}
              </Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onDelete}>
              <Text style={styles.btnGhostText}>Remove</Text>
            </Pressable>
          </>
        ) : running ? (
          <>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onPause}>
              <Text style={styles.btnGhostText}>Pause</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onCancel}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => onDownload({ quantId, projectorId })}>
              <Icon name="download" size={14} color={c.onAccent} />
              <Text style={styles.btnPrimaryText}>
                {paused || failed ? 'Resume' : 'Download'}
              </Text>
            </Pressable>
            {model.quants.length > 1 || (model.mmproj?.length ?? 0) > 1 ? (
              <Pressable
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setOptionsOpen(true)}>
                <Text style={styles.btnGhostText}>{quant.id}</Text>
                <Icon name="chevronDown" size={11} color={c.textSecondary} />
              </Pressable>
            ) : null}
          </>
        )}
        <Pressable
          style={[styles.btn, styles.btnGhost]}
          onPress={() => setLinksOpen(true)}>
          <Icon name="link" size={14} color={c.textSecondary} />
          <Text style={styles.btnGhostText}>Links</Text>
        </Pressable>
      </View>

      <Sheet
        visible={optionsOpen}
        title={`${model.label} — download options`}
        subtitle="Smaller quantisations use less memory and run faster; larger ones answer more accurately."
        onClose={() => setOptionsOpen(false)}>
        <SheetSection label="Quantisation" />
        {model.quants.map(q => (
          <SheetRow
            key={q.id}
            label={q.id}
            detail={`${formatBytes(q.sizeBytes)}${q.note ? ` · ${q.note}` : ''}`}
            selected={q.id === quantId}
            onPress={() => setQuantId(q.id)}
          />
        ))}
        {(model.mmproj?.length ?? 0) > 1 && (
          <>
            <SheetSection label="Vision projector" />
            {model.mmproj!.map(p => (
              <SheetRow
                key={p.id}
                label={p.id}
                detail={formatBytes(p.sizeBytes)}
                selected={p.id === projectorId}
                onPress={() => setProjectorId(p.id)}
              />
            ))}
          </>
        )}
      </Sheet>

      <Sheet
        visible={linksOpen}
        title={`${model.label} — direct links`}
        subtitle={`${model.repo} · ${model.license}. Download these with any browser or download manager and drop the file in your models folder; the app picks it up on its own.`}
        onClose={() => setLinksOpen(false)}>
        <SheetSection label="Model file" />
        <SheetRow
          icon="copy"
          label={`Copy link · ${quant.id}`}
          detail={`${quant.filename} · ${formatBytes(quant.sizeBytes)}`}
          onPress={() => {
            copy('Model', downloadUrl(model, quant.filename));
            setLinksOpen(false);
          }}
        />
        {!!projector && (
          <>
            <SheetSection label="Vision projector (needed for images)" />
            <SheetRow
              icon="copy"
              label={`Copy link · ${projector.id}`}
              detail={`${projector.filename} · ${formatBytes(projector.sizeBytes)}`}
              onPress={() => {
                copy('Projector', downloadUrl(model, projector.filename));
                setLinksOpen(false);
              }}
            />
          </>
        )}
        <SheetSection label="Elsewhere" />
        <SheetRow
          icon="link"
          label="Open the repository"
          detail="Every quantisation and file, on Hugging Face."
          onPress={() => {
            DocKit.openUrl(getRepoPageUrl(model));
            setLinksOpen(false);
          }}
        />
        <SheetRow
          icon="download"
          label="Open the file link in a browser"
          detail="Hands the download to your browser or download manager instead."
          onPress={() => {
            DocKit.openUrl(downloadUrl(model, quant.filename));
            setLinksOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardActive: { borderColor: c.accent },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headText: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: {
    color: c.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: '700',
    flexShrink: 1,
  },
  star: {
    backgroundColor: c.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  starText: { color: c.accent, fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  meta: { color: c.textFaint, fontSize: fontSizes.xxs, marginTop: 2 },
  installedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: c.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  installedText: { color: c.success, fontSize: 10, fontWeight: '700' },
  description: {
    color: c.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  tag: {
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  tagText: { color: c.textSecondary, fontSize: 10, fontWeight: '600' },
  tagWarn: { backgroundColor: c.warningSoft },
  tagWarnText: { color: c.warning },
  tagDanger: { backgroundColor: c.dangerSoft },
  tagDangerText: { color: c.danger },
  progress: { marginTop: spacing.md, gap: spacing.xs },
  progressText: { color: c.textFaint, fontSize: fontSizes.xxs, lineHeight: 16 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  btnPrimary: { backgroundColor: c.accent },
  btnPrimaryText: { color: c.onAccent, fontSize: fontSizes.xs, fontWeight: '700' },
  btnGhost: { backgroundColor: c.surfaceAlt },
  btnGhostText: { color: c.textSecondary, fontSize: fontSizes.xs, fontWeight: '700' },
}));
