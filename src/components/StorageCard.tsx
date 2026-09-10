import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Icon from './Icon';
import Sheet, { SheetRow, SheetSection } from './Sheet';
import { DocKit, StorageOption } from '../native/DocKit';
import {
  LEGACY_MODELS_DIR,
  ResolvedStorage,
  legacyLeftovers,
  listStorageOptions,
  migrateModels,
  resolveModelsDir,
  setModelsDir,
} from '../services/storage';
import { formatBytes, repointRegistry } from '../services/modelManager';
import { makeStyles, useColors } from '../context/ThemeContext';
import { fontSizes, radius, spacing } from '../theme';

/**
 * Where models are kept, and how to move them.
 *
 * This is the card that fixes the app's worst old behaviour: model files used
 * to be written into app-private storage, where nothing else on the phone
 * could reach them and an uninstall took several gigabytes with it. They now
 * live in a shared folder that any other local-AI app can load from, and this
 * card is where that folder is chosen, verified, and migrated.
 */
export default function StorageCard({
  onChanged,
  showTitle = true,
}: {
  onChanged?: () => void;
  showTitle?: boolean;
}) {
  const c = useColors();
  const styles = useStyles();

  const [storage, setStorage] = useState<ResolvedStorage | null>(null);
  const [options, setOptions] = useState<StorageOption[]>([]);
  const [leftovers, setLeftovers] = useState<{ count: number; bytes: number }>({
    count: 0,
    bytes: 0,
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const resolved = await resolveModelsDir(true);
    setStorage(resolved);
    setOptions(await listStorageOptions());
    setLeftovers(await legacyLeftovers());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const choose = useCallback(
    async (option: StorageOption) => {
      if (!option.writable) {
        setNotice(
          option.needsAllFiles
            ? 'Android needs all-files access before the app can write there. Grant it, then pick the folder again.'
            : 'That folder is not writable on this device.',
        );
        return;
      }
      setBusy(option.id);
      setNotice(null);
      const previous = storage?.dir;
      const failure = await setModelsDir(option.path, option.id);
      if (failure) {
        setBusy(null);
        setNotice(failure);
        return;
      }

      // Anything already downloaded follows the setting, otherwise the app
      // would appear to have lost every model the moment you change folder.
      if (previous && previous !== option.path) {
        const result = await migrateModels(previous, option.path);
        await repointRegistry(previous, option.path, result.moves);
        if (result.moved.length) {
          setNotice(
            `Moved ${result.moved.length} file${
              result.moved.length === 1 ? '' : 's'
            } to the new folder.`,
          );
        }
        if (result.failed.length) {
          setNotice(
            `${result.failed.length} file could not be moved: ${result.failed[0].message}`,
          );
        }
      }
      setPickerOpen(false);
      setBusy(null);
      await refresh();
      onChanged?.();
    },
    [storage, refresh, onChanged],
  );

  const rescueLegacy = useCallback(async () => {
    if (!storage) return;
    setBusy('legacy');
    const result = await migrateModels(LEGACY_MODELS_DIR, storage.dir);
    await repointRegistry(LEGACY_MODELS_DIR, storage.dir, result.moves);
    setBusy(null);
    setNotice(
      result.failed.length
        ? `Moved ${result.moved.length}, failed on ${result.failed.length}: ${result.failed[0].message}`
        : `Moved ${result.moved.length} file${
            result.moved.length === 1 ? '' : 's'
          } out of app storage. Other apps can read them now.`,
    );
    await refresh();
    onChanged?.();
  }, [storage, refresh, onChanged]);

  const grant = useCallback(async () => {
    await DocKit.requestAllFilesAccess();
    setNotice(
      'Turn on "Allow access to manage all files", then come back and pick the folder.',
    );
  }, []);

  if (!storage) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const shared = storage.shared;

  return (
    <View style={styles.card}>
      {showTitle && (
        <View style={styles.head}>
          <Icon name="storage" size={17} color={c.textSecondary} />
          <Text style={styles.title}>Models folder</Text>
        </View>
      )}

      <Text style={styles.path} numberOfLines={2}>
        {storage.dir}
      </Text>

      <View style={styles.badges}>
        <View style={[styles.badge, shared ? styles.badgeGood : styles.badgeWarn]}>
          <Text style={[styles.badgeText, shared ? styles.goodText : styles.warnText]}>
            {shared ? 'Shared with other apps' : 'Private to this app'}
          </Text>
        </View>
        {!!storage.option && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {formatBytes(storage.option.freeBytes)} free
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.body}>
        {shared
          ? 'Any .gguf you put in this folder shows up in the app, and other AI apps on the phone can load the same file — one copy, not one per app.'
          : 'This location is only visible to Offline AI, so another app cannot use the same model files. Grant all-files access to keep them in a shared folder instead.'}
      </Text>

      {!!storage.fallbackReason && (
        <Text style={styles.warning}>{storage.fallbackReason}</Text>
      )}

      {leftovers.count > 0 && (
        <View style={styles.rescue}>
          <Text style={styles.rescueText}>
            {leftovers.count} model file{leftovers.count === 1 ? '' : 's'} (
            {formatBytes(leftovers.bytes)}) {leftovers.count === 1 ? 'is' : 'are'}{' '}
            still inside the app's private storage from an older version.
          </Text>
          <Pressable style={styles.rescueBtn} onPress={rescueLegacy} disabled={!!busy}>
            {busy === 'legacy' ? (
              <ActivityIndicator size="small" color={c.onAccent} />
            ) : (
              <Text style={styles.rescueBtnText}>Move them to the shared folder</Text>
            )}
          </Pressable>
        </View>
      )}

      {!!notice && <Text style={styles.notice}>{notice}</Text>}

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => setPickerOpen(true)}>
          <Text style={styles.btnPrimaryText}>Change folder</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnGhost]}
          onPress={() => {
            DocKit.setClipboard(storage.dir);
            setNotice('Folder path copied.');
          }}>
          <Icon name="copy" size={13} color={c.textSecondary} />
          <Text style={styles.btnGhostText}>Copy path</Text>
        </Pressable>
      </View>

      <Sheet
        visible={pickerOpen}
        title="Where should models be kept?"
        subtitle="A shared folder means one copy of each model on the phone, usable by any app that can open a .gguf. The app folder needs no permission but nothing else can read it."
        onClose={() => setPickerOpen(false)}>
        <SheetSection label="Shared with every app" />
        {options
          .filter(o => o.shared)
          .map(o => (
            <SheetRow
              key={o.id}
              icon="folder"
              label={o.label}
              detail={`${o.path}\n${formatBytes(o.freeBytes)} free${
                o.modelCount ? ` · ${o.modelCount} model files already here` : ''
              }${o.writable ? '' : ' · needs all-files access'}`}
              selected={o.path === storage.dir}
              disabled={!!busy}
              onPress={() => choose(o)}
            />
          ))}
        <SheetSection label="Private to this app" />
        {options
          .filter(o => !o.shared)
          .map(o => (
            <SheetRow
              key={o.id}
              icon="phone"
              label={o.label}
              detail={`${o.path}\n${formatBytes(o.freeBytes)} free${
                o.modelCount ? ` · ${o.modelCount} model files already here` : ''
              }`}
              selected={o.path === storage.dir}
              disabled={!!busy}
              onPress={() => choose(o)}
            />
          ))}
        {options.some(o => o.shared && !o.writable) && (
          <>
            <SheetSection label="Permission" />
            <SheetRow
              icon="info"
              label="Grant all-files access"
              detail="Opens the Android setting. Needed only for shared folders; the app works without it."
              onPress={grant}
            />
          </>
        )}
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
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: c.textPrimary, fontSize: fontSizes.sm, fontWeight: '700' },
  path: {
    color: c.textPrimary,
    fontFamily: 'monospace',
    fontSize: fontSizes.xs,
    marginTop: spacing.sm,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  badge: {
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeGood: { backgroundColor: c.successSoft },
  badgeWarn: { backgroundColor: c.warningSoft },
  badgeText: { color: c.textSecondary, fontSize: 10, fontWeight: '700' },
  goodText: { color: c.success },
  warnText: { color: c.warning },
  body: {
    color: c.textSecondary,
    fontSize: fontSizes.xs,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  warning: {
    color: c.warning,
    fontSize: fontSizes.xs,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  notice: {
    color: c.accent,
    fontSize: fontSizes.xs,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  rescue: {
    backgroundColor: c.warningSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  rescueText: { color: c.warning, fontSize: fontSizes.xs, lineHeight: 18 },
  rescueBtn: {
    backgroundColor: c.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  rescueBtnText: { color: c.onAccent, fontSize: fontSizes.xs, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
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
