import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MODEL_CATALOG,
  ModelEntry,
  ModelTag,
  TAG_LABELS,
} from '../data/modelCatalog';
import {
  DownloadStatus,
  InstalledModel,
  cancelDownload,
  finalizeCatalogModel,
  formatBytes,
  importModelFromUri,
  importScannedModel,
  pauseDownload,
  removeInstalled,
  startDownload,
  subscribeDownloads,
} from '../services/modelManager';
import { DocKit, PICK_GGUF, ScannedModelFile } from '../native/DocKit';
import { useLlama } from '../context/LlamaContext';
import ModelListItem from '../components/ModelListItem';
import { colors, fontSizes, radius, spacing, useLayout } from '../theme';

type Filter = 'all' | ModelTag;

const FILTERS: Filter[] = ['all', 'recommended', 'vision', 'uncensored', 'tiny', 'coding'];

export default function ModelsScreen({ onLoaded }: { onLoaded: () => void }) {
  const { installed, refreshInstalled, activeModel, loadModel } = useLlama();
  const insets = useSafeAreaInsets();
  const layout = useLayout();

  const [statuses, setStatuses] = useState<Record<string, DownloadStatus>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScannedModelFile[] | null>(null);
  const [deviceRamGiB, setDeviceRamGiB] = useState<number | undefined>();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    DocKit.getDeviceInfo().then(info => {
      if (info) setDeviceRamGiB(info.totalRamBytes / 1024 ** 3);
    });
  }, []);

  useEffect(() => {
    return subscribeDownloads(async s => {
      setStatuses(prev => ({ ...prev, [`${s.modelId}:${s.part}`]: s }));

      if (s.state === 'done') {
        const model = MODEL_CATALOG.find(m => m.id === s.modelId);
        // A vision model isn't usable until its projector has landed too,
        // so chain straight into the second file rather than making the
        // user notice and start it themselves.
        if (model?.mmproj && s.part === 'model') {
          startDownload(model, 'mmproj').catch(() => {});
          return;
        }
        const done = await finalizeCatalogModel(s.modelId);
        if (done) {
          await refreshInstalled();
          setNotice(`${done.label} is ready to load.`);
        }
      }
    });
  }, [refreshInstalled]);

  const installedIds = useMemo(
    () => new Set(installed.map(m => m.id)),
    [installed],
  );

  const visible = useMemo(
    () =>
      filter === 'all'
        ? MODEL_CATALOG
        : MODEL_CATALOG.filter(m => m.tags.includes(filter as ModelTag)),
    [filter],
  );

  const statusFor = useCallback(
    (id: string) => ({
      model: statuses[`${id}:model`],
      mmproj: statuses[`${id}:mmproj`],
    }),
    [statuses],
  );

  // ---- actions -------------------------------------------------------

  const handleDownload = useCallback(async (model: ModelEntry) => {
    setNotice(null);
    try {
      await startDownload(model, 'model');
    } catch (e: any) {
      setNotice(e?.message ?? 'Could not start the download.');
    }
  }, []);

  const handleLoad = useCallback(
    async (id: string) => {
      const target = installed.find(m => m.id === id);
      if (!target) return;
      await loadModel(target);
      onLoaded();
    },
    [installed, loadModel, onLoaded],
  );

  const handleDelete = useCallback(
    (id: string, label: string) => {
      Alert.alert('Remove model', `Remove ${label}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeInstalled(id);
            await refreshInstalled();
          },
        },
      ]);
    },
    [refreshInstalled],
  );

  const handleImport = useCallback(async () => {
    setNotice(null);
    setBusy('import');
    try {
      const files = await DocKit.pickFiles(PICK_GGUF, true);
      const ggufs = files.filter(f => f.name.toLowerCase().endsWith('.gguf'));
      if (!ggufs.length) {
        if (files.length) setNotice('That file is not a .gguf model.');
        return;
      }
      // If a projector was picked alongside the model, pair them up.
      const proj = ggufs.find(f => f.name.toLowerCase().includes('mmproj'));
      const main = ggufs.find(f => f !== proj) ?? ggufs[0];

      const { installed: added, copied } = await importModelFromUri(
        main.uri,
        main.name,
        proj ? { mmprojUri: proj.uri, mmprojName: proj.name } : {},
      );
      await refreshInstalled();
      setNotice(
        copied
          ? `${added.label} was copied into the app. It works, but it now takes up space twice — you can delete the original from Downloads.`
          : `${added.label} is linked from where it already sits. No extra storage used.`,
      );
    } catch (e: any) {
      setNotice(e?.message ?? 'Import failed.');
    } finally {
      setBusy(null);
    }
  }, [refreshInstalled]);

  const handleScan = useCallback(async () => {
    setNotice(null);
    setBusy('scan');
    try {
      const granted = await DocKit.hasAllFilesAccess();
      if (!granted) {
        Alert.alert(
          'Storage access needed',
          'To find .gguf files in your Downloads folder directly, the app needs all-files access. You can skip this and use "Import a .gguf" instead — that works without any permission.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open settings', onPress: () => DocKit.requestAllFilesAccess() },
          ],
        );
        return;
      }
      const found = await DocKit.scanForModels();
      setScanned(found);
      if (!found.length) setNotice('No .gguf files found in Downloads or Documents.');
    } finally {
      setBusy(null);
    }
  }, []);

  const handleUseScanned = useCallback(
    async (file: ScannedModelFile) => {
      const proj = scanned?.find(
        f =>
          f.isMmproj &&
          f.path.substring(0, f.path.lastIndexOf('/')) ===
            file.path.substring(0, file.path.lastIndexOf('/')),
      );
      await importScannedModel(file.path, file.name, proj?.path);
      await refreshInstalled();
      setScanned(null);
      setNotice(`${file.name} added.`);
    },
    [scanned, refreshInstalled],
  );

  // ---- render --------------------------------------------------------

  const header = (
    <View style={{ maxWidth: layout.contentWidth, width: '100%', alignSelf: 'center' }}>
      <Text style={styles.title}>Models</Text>
      <Text style={styles.subtitle}>
        Anything you install here runs entirely on this phone. Download inside
        the app if that's convenient, or take the direct link, fetch the file
        however you like, and import it from your Downloads folder.
      </Text>

      <View style={styles.importRow}>
        <Pressable style={styles.importBtn} onPress={handleImport}>
          {busy === 'import' ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Text style={styles.importBtnText}>Import a .gguf</Text>
          )}
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={handleScan}>
          {busy === 'scan' ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <Text style={styles.secondaryBtnText}>Scan storage</Text>
          )}
        </Pressable>
      </View>

      {!!notice && <Text style={styles.notice}>{notice}</Text>}

      {!!scanned?.length && (
        <View style={styles.scanBox}>
          <Text style={styles.scanTitle}>Found on this device</Text>
          {scanned
            .filter(f => !f.isMmproj)
            .map(f => (
              <Pressable
                key={f.path}
                style={styles.scanRow}
                onPress={() => handleUseScanned(f)}>
                <View style={styles.flex}>
                  <Text style={styles.scanName} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={styles.scanPath} numberOfLines={1}>
                    {formatBytes(f.size)} · {f.path}
                  </Text>
                </View>
                <Text style={styles.scanAdd}>Add</Text>
              </Pressable>
            ))}
          <Pressable onPress={() => setScanned(null)} hitSlop={8}>
            <Text style={styles.scanDismiss}>Dismiss</Text>
          </Pressable>
        </View>
      )}

      {installed.length > 0 && (
        <View style={styles.installedBox}>
          <Text style={styles.sectionLabel}>Installed</Text>
          {installed.map(m => (
            <InstalledRow
              key={m.id}
              model={m}
              active={activeModel?.id === m.id}
              onLoad={() => handleLoad(m.id)}
              onDelete={() => handleDelete(m.id, m.label)}
            />
          ))}
        </View>
      )}

      <Text style={styles.sectionLabel}>Catalog</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}>
        {FILTERS.map(f => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filter, filter === f && styles.filterActive]}>
            <Text
              style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Everything' : TAG_LABELS[f as ModelTag]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <FlatList
      style={styles.flex}
      data={visible}
      keyExtractor={m => m.id}
      ListHeaderComponent={header}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingHorizontal: layout.compact ? spacing.lg : spacing.xl,
        paddingBottom: spacing.xl,
      }}
      renderItem={({ item }) => (
        <View style={{ maxWidth: layout.contentWidth, width: '100%', alignSelf: 'center' }}>
          <ModelListItem
            model={item}
            installed={installedIds.has(item.id)}
            active={activeModel?.id === item.id}
            status={statusFor(item.id)}
            deviceRamGiB={deviceRamGiB}
            onDownload={() => handleDownload(item)}
            onPause={() => {
              pauseDownload(`${item.id}:model`);
              pauseDownload(`${item.id}:mmproj`);
            }}
            onCancel={() => {
              cancelDownload(`${item.id}:model`);
              cancelDownload(`${item.id}:mmproj`);
              setStatuses(prev => {
                const next = { ...prev };
                delete next[`${item.id}:model`];
                delete next[`${item.id}:mmproj`];
                return next;
              });
            }}
            onLoad={() => handleLoad(item.id)}
            onDelete={() => handleDelete(item.id, item.label)}
          />
        </View>
      )}
    />
  );
}

function InstalledRow({
  model,
  active,
  onLoad,
  onDelete,
}: {
  model: InstalledModel;
  active: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.installedRow, active && styles.installedRowActive]}>
      <View style={styles.flex}>
        <Text style={styles.installedName} numberOfLines={1}>
          {model.label}
        </Text>
        <Text style={styles.installedMeta} numberOfLines={1}>
          {formatBytes(model.sizeBytes)}
          {model.mmprojPath ? ' · vision' : ''}
          {model.external ? ' · linked in place' : ''}
        </Text>
      </View>
      <Pressable onPress={onLoad} hitSlop={8} disabled={active}>
        <Text style={[styles.installedAction, active && styles.installedActive]}>
          {active ? 'Loaded' : 'Load'}
        </Text>
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8}>
        <Text style={styles.installedRemove}>Remove</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.xxl,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  importRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  importBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minWidth: 140,
    alignItems: 'center',
  },
  importBtnText: {
    color: colors.onAccent,
    fontWeight: '700',
    fontSize: fontSizes.sm,
  },
  secondaryBtn: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minWidth: 120,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: fontSizes.sm,
  },
  notice: {
    color: colors.accent,
    fontSize: fontSizes.xs,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  scanBox: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  scanTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  scanName: { color: colors.textPrimary, fontSize: fontSizes.sm },
  scanPath: { color: colors.textFaint, fontSize: fontSizes.xxs, marginTop: 1 },
  scanAdd: {
    color: colors.accent,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    paddingLeft: spacing.md,
  },
  scanDismiss: {
    color: colors.textFaint,
    fontSize: fontSizes.xs,
    marginTop: spacing.sm,
  },
  installedBox: { marginTop: spacing.xl },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: fontSizes.xxs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  installedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  installedRowActive: { borderColor: colors.accent },
  installedName: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  installedMeta: { color: colors.textFaint, fontSize: fontSizes.xxs, marginTop: 1 },
  installedAction: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '700' },
  installedActive: { color: colors.success },
  installedRemove: { color: colors.textFaint, fontSize: fontSizes.xs, fontWeight: '600' },
  filters: { gap: spacing.sm, paddingBottom: spacing.md },
  filter: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  filterActive: { backgroundColor: colors.accentSoft },
  filterText: { color: colors.textSecondary, fontSize: fontSizes.xs, fontWeight: '600' },
  filterTextActive: { color: colors.accent },
});
