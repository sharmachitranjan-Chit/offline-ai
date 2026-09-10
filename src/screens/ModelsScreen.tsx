import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from '../components/Icon';
import ModelListItem, { ModelChoice } from '../components/ModelListItem';
import Sheet, { SheetRow, SheetSection } from '../components/Sheet';
import StorageCard from '../components/StorageCard';
import TopBar from '../components/TopBar';
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
import { makeStyles, useColors } from '../context/ThemeContext';
import { fontSizes, radius, spacing, useLayout } from '../theme';

type Filter = 'all' | ModelTag;

const FILTERS: Filter[] = [
  'all',
  'recommended',
  'vision',
  'uncensored',
  'reasoning',
  'coding',
  'multilingual',
  'tiny',
];

export default function ModelsScreen({
  onBack,
  onLoaded,
}: {
  onBack: () => void;
  onLoaded: () => void;
}) {
  const { installed, refreshInstalled, activeModel, loadModel } = useLlama();
  const c = useColors();
  const styles = useStyles();
  const layout = useLayout();

  const [statuses, setStatuses] = useState<Record<string, DownloadStatus>>({});
  const choices = useRef<Record<string, ModelChoice>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScannedModelFile[] | null>(null);
  const [deviceRamGiB, setDeviceRamGiB] = useState<number | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<InstalledModel | null>(null);

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
        const choice = choices.current[s.modelId] ?? {};
        // A vision model isn't usable until its projector has landed too, so
        // chain straight into the second file rather than making the user
        // notice and start it themselves.
        if (model?.mmproj?.length && s.part === 'model') {
          startDownload(model, 'mmproj', choice).catch(() => {});
          return;
        }
        const done = await finalizeCatalogModel(s.modelId, choice);
        if (done) {
          await refreshInstalled();
          setNotice(`${done.label} is ready to load.`);
        }
      }
    });
  }, [refreshInstalled]);

  const installedIds = useMemo(() => new Set(installed.map(m => m.id)), [installed]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MODEL_CATALOG.filter(m => {
      if (filter !== 'all' && !m.tags.includes(filter as ModelTag)) return false;
      if (!q) return true;
      return (
        m.label.toLowerCase().includes(q) ||
        m.publisher.toLowerCase().includes(q) ||
        m.repo.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
      );
    });
  }, [filter, query]);

  const statusFor = useCallback(
    (id: string) => ({
      model: statuses[`${id}:model`],
      mmproj: statuses[`${id}:mmproj`],
    }),
    [statuses],
  );

  // ---- actions -------------------------------------------------------

  const handleDownload = useCallback(async (model: ModelEntry, choice: ModelChoice) => {
    setNotice(null);
    choices.current[model.id] = choice;
    try {
      await startDownload(model, 'model', choice);
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
          ? `${added.label} was copied into the models folder. You can delete the original to get the space back.`
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
      const found = await DocKit.scanForModels();
      const fresh = found.filter(f => !installed.some(m => m.path === f.path));
      setScanned(fresh);
      if (!fresh.length) {
        const granted = await DocKit.hasAllFilesAccess();
        setNotice(
          granted
            ? 'No new .gguf files found in the usual folders.'
            : 'Nothing found. Without all-files access the app can only look in its own folders — grant it in Settings to search the whole phone.',
        );
      }
    } finally {
      setBusy(null);
    }
  }, [installed]);

  const handleUseScanned = useCallback(
    async (file: ScannedModelFile) => {
      const dir = file.path.substring(0, file.path.lastIndexOf('/'));
      const proj = scanned?.find(
        f => f.isMmproj && f.path.startsWith(dir),
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
    <View style={styles.column}>
      <StorageCard onChanged={refreshInstalled} />

      <View style={styles.importRow}>
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleImport}>
          {busy === 'import' ? (
            <ActivityIndicator size="small" color={c.onAccent} />
          ) : (
            <>
              <Icon name="folder" size={14} color={c.onAccent} />
              <Text style={styles.btnPrimaryText}>Import a .gguf</Text>
            </>
          )}
        </Pressable>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={handleScan}>
          {busy === 'scan' ? (
            <ActivityIndicator size="small" color={c.textPrimary} />
          ) : (
            <>
              <Icon name="search" size={14} color={c.textSecondary} />
              <Text style={styles.btnGhostText}>Scan storage</Text>
            </>
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
        <>
          <Text style={styles.sectionLabel}>Installed</Text>
          {installed.map(m => (
            <View
              key={m.id}
              style={[
                styles.installedRow,
                activeModel?.id === m.id && styles.installedRowActive,
              ]}>
              <View style={styles.flex}>
                <Text style={styles.installedName} numberOfLines={1}>
                  {m.label}
                </Text>
                <Text style={styles.installedMeta} numberOfLines={1}>
                  {formatBytes(m.sizeBytes)}
                  {m.quantId ? ` · ${m.quantId}` : ''}
                  {m.mmprojPath ? ' · sees images' : ''}
                  {m.external ? ' · outside the models folder' : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => handleLoad(m.id)}
                hitSlop={8}
                disabled={activeModel?.id === m.id}>
                <Text
                  style={[
                    styles.installedAction,
                    activeModel?.id === m.id && styles.installedActive,
                  ]}>
                  {activeModel?.id === m.id ? 'Loaded' : 'Load'}
                </Text>
              </Pressable>
              <Pressable onPress={() => setRemoving(m)} hitSlop={8}>
                <Icon name="more" size={14} color={c.textFaint} />
              </Pressable>
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionLabel}>Catalog · {MODEL_CATALOG.length} models</Text>
      <View style={styles.searchBox}>
        <Icon name="search" size={14} color={c.textFaint} />
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, publisher or repo"
          placeholderTextColor={c.textFaint}
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Icon name="close" size={11} color={c.textFaint} />
          </Pressable>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}>
        {FILTERS.map(f => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filter, filter === f && styles.filterActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Everything' : TAG_LABELS[f as ModelTag]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.flex}>
      <TopBar
        title="Models"
        subtitle={`${installed.length} installed · ${MODEL_CATALOG.length} in the catalog`}
        leading="back"
        onLeading={onBack}
      />
      <FlatList
        style={styles.flex}
        data={visible}
        keyExtractor={m => m.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: spacing.md,
          paddingHorizontal: layout.compact ? spacing.lg : spacing.xl,
          paddingBottom: spacing.xxl,
        }}
        ListEmptyComponent={
          <Text style={styles.notice}>Nothing in the catalog matches that.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.column}>
            <ModelListItem
              model={item}
              installed={installedIds.has(item.id)}
              active={activeModel?.id === item.id}
              status={statusFor(item.id)}
              deviceRamGiB={deviceRamGiB}
              onDownload={choice => handleDownload(item, choice)}
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
              onDelete={() => {
                const target = installed.find(m => m.id === item.id);
                if (target) setRemoving(target);
              }}
              onNotify={setNotice}
            />
          </View>
        )}
      />

      <Sheet
        visible={!!removing}
        title={removing?.label}
        subtitle={
          removing?.external
            ? 'This file sits outside the models folder, so the app will only forget about it.'
            : 'The file is in your shared models folder — another app may be using it too.'
        }
        onClose={() => setRemoving(null)}>
        <SheetSection label="Remove" />
        <SheetRow
          icon="close"
          label="Forget it here"
          detail="Leaves the file exactly where it is."
          onPress={async () => {
            if (removing) await removeInstalled(removing.id, false);
            setRemoving(null);
            await refreshInstalled();
          }}
        />
        {!removing?.external && (
          <SheetRow
            icon="trash"
            label={`Delete the file (${formatBytes(removing?.sizeBytes ?? 0)})`}
            detail="Frees the space. Any other app pointed at this folder loses it too."
            danger
            onPress={async () => {
              if (removing) await removeInstalled(removing.id, true);
              setRemoving(null);
              await refreshInstalled();
            }}
          />
        )}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  flex: { flex: 1 },
  column: { maxWidth: 760, width: '100%', alignSelf: 'center' },
  importRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minWidth: 140,
  },
  btnPrimary: { backgroundColor: c.accent },
  btnPrimaryText: { color: c.onAccent, fontWeight: '700', fontSize: fontSizes.sm },
  btnGhost: { backgroundColor: c.surfaceHigh },
  btnGhostText: { color: c.textSecondary, fontWeight: '700', fontSize: fontSizes.sm },
  notice: {
    color: c.accent,
    fontSize: fontSizes.xs,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  scanBox: {
    marginTop: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
  },
  scanTitle: {
    color: c.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
  },
  scanName: { color: c.textPrimary, fontSize: fontSizes.sm },
  scanPath: { color: c.textFaint, fontSize: fontSizes.xxs, marginTop: 1 },
  scanAdd: {
    color: c.accent,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    paddingLeft: spacing.md,
  },
  scanDismiss: { color: c.textFaint, fontSize: fontSizes.xs, marginTop: spacing.sm },
  sectionLabel: {
    color: c.textFaint,
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
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  installedRowActive: { borderColor: c.accent },
  installedName: { color: c.textPrimary, fontSize: fontSizes.sm, fontWeight: '600' },
  installedMeta: { color: c.textFaint, fontSize: fontSizes.xxs, marginTop: 1 },
  installedAction: { color: c.accent, fontSize: fontSizes.xs, fontWeight: '700' },
  installedActive: { color: c.success },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  search: {
    flex: 1,
    color: c.textPrimary,
    fontSize: fontSizes.sm,
    paddingVertical: spacing.sm + 2,
  },
  filters: { gap: spacing.sm, paddingBottom: spacing.md },
  filter: {
    backgroundColor: c.surfaceHigh,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  filterActive: { backgroundColor: c.accentSoft },
  filterText: { color: c.textSecondary, fontSize: fontSizes.xs, fontWeight: '600' },
  filterTextActive: { color: c.accent },
}));
