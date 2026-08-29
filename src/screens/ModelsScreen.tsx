import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MODEL_CATALOG, ModelEntry } from '../data/modelCatalog';
import {
  cancelDownload,
  DownloadProgress,
  formatBytes,
  getDownloadedModelIds,
  deleteModel as deleteModelFile,
  startModelDownload,
} from '../services/modelManager';
import { useLlama } from '../context/LlamaContext';
import ModelListItem from '../components/ModelListItem';
import { colors, fontSizes, spacing } from '../theme';

type DownloadState = {
  jobId: number;
  progress: DownloadProgress;
};

export default function ModelsScreen() {
  const { loadState, activeModel, loadModel, unloadModel } = useLlama();
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>(
    {},
  );
  const [errorByModel, setErrorByModel] = useState<Record<string, string>>({});
  const mounted = useRef(true);

  const refreshDownloaded = useCallback(async () => {
    const ids = await getDownloadedModelIds();
    if (mounted.current) setDownloadedIds(ids);
  }, []);

  useEffect(() => {
    mounted.current = true;
    refreshDownloaded();
    return () => {
      mounted.current = false;
    };
  }, [refreshDownloaded]);

  const handleDownload = useCallback((model: ModelEntry) => {
    setErrorByModel(prev => ({ ...prev, [model.id]: '' }));
    const { jobId, promise } = startModelDownload(model, progress => {
      if (!mounted.current) return;
      setDownloads(prev => ({ ...prev, [model.id]: { jobId, progress } }));
    });
    setDownloads(prev => ({
      ...prev,
      [model.id]: { jobId, progress: { bytesWritten: 0, contentLength: 0, fraction: 0 } },
    }));

    promise
      .then(() => {
        if (!mounted.current) return;
        setDownloads(prev => {
          const next = { ...prev };
          delete next[model.id];
          return next;
        });
        refreshDownloaded();
      })
      .catch(err => {
        if (!mounted.current) return;
        setDownloads(prev => {
          const next = { ...prev };
          delete next[model.id];
          return next;
        });
        setErrorByModel(prev => ({
          ...prev,
          [model.id]: err?.message ?? 'Download failed.',
        }));
      });
  }, [refreshDownloaded]);

  const handleCancel = useCallback((model: ModelEntry) => {
    const dl = downloads[model.id];
    if (dl) {
      cancelDownload(dl.jobId);
      setDownloads(prev => {
        const next = { ...prev };
        delete next[model.id];
        return next;
      });
    }
  }, [downloads]);

  const handleDelete = useCallback(async (model: ModelEntry) => {
    if (activeModel?.id === model.id) {
      await unloadModel();
    }
    await deleteModelFile(model);
    refreshDownloaded();
  }, [activeModel, unloadModel, refreshDownloaded]);

  const handleSelect = useCallback((model: ModelEntry) => {
    loadModel(model.id);
  }, [loadModel]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Model Library</Text>
        <Text style={styles.subtitle}>
          Everything below runs fully on-device once downloaded — no
          internet needed afterward. Wi-Fi is recommended for the download
          itself, since files range from ~0.4–2.3 GB.
        </Text>
        {loadState.status === 'loading' && (
          <Text style={styles.loadingNote}>
            Loading {activeModel?.label}… {Math.round(loadState.progress)}%
          </Text>
        )}
        {loadState.status === 'error' && (
          <Text style={styles.errorNote}>
            Couldn't load {activeModel?.label ?? 'model'}: {loadState.message}
          </Text>
        )}
      </View>

      <FlatList
        data={MODEL_CATALOG}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingVertical: spacing.sm }}
        renderItem={({ item }) => {
          const dl = downloads[item.id];
          const err = errorByModel[item.id];
          return (
            <View>
              <ModelListItem
                model={item}
                isDownloaded={downloadedIds.has(item.id)}
                isActive={activeModel?.id === item.id}
                downloadFraction={dl ? Math.max(dl.progress.fraction, 0) : undefined}
                downloadedBytesLabel={
                  dl
                    ? `${formatBytes(dl.progress.bytesWritten)}${
                        dl.progress.contentLength
                          ? ` / ${formatBytes(dl.progress.contentLength)}`
                          : ''
                      }`
                    : undefined
                }
                onDownload={() => handleDownload(item)}
                onCancelDownload={() => handleCancel(item)}
                onDelete={() => handleDelete(item)}
                onSelect={() => handleSelect(item)}
              />
              {!!err && <Text style={styles.itemError}>{err}</Text>}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  loadingNote: {
    color: colors.accent,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  errorNote: {
    color: colors.danger,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  itemError: {
    color: colors.danger,
    fontSize: fontSizes.xs,
    marginHorizontal: spacing.md + spacing.md,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
  },
});
