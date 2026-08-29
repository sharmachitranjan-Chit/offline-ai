import * as RNFS from '@dr.pogodin/react-native-fs';
import type { DownloadProgressCallbackResultT } from '@dr.pogodin/react-native-fs';
import { MODEL_CATALOG, ModelEntry, getModelDownloadUrl } from '../data/modelCatalog';

/**
 * All model files live in a dedicated "models" folder inside the app's
 * private document directory. Nothing here needs any special Android
 * storage permission — it's the app's own sandboxed space.
 */
export const MODELS_DIR = `${RNFS.DocumentDirectoryPath}/models`;

export function localPathForModel(model: ModelEntry): string {
  return `${MODELS_DIR}/${model.id}.gguf`;
}

export async function ensureModelsDir(): Promise<void> {
  const dirExists = await RNFS.exists(MODELS_DIR);
  if (!dirExists) {
    await RNFS.mkdir(MODELS_DIR);
  }
}

export async function isModelDownloaded(model: ModelEntry): Promise<boolean> {
  return RNFS.exists(localPathForModel(model));
}

export async function getDownloadedModelIds(): Promise<Set<string>> {
  await ensureModelsDir();
  const results = await Promise.all(
    MODEL_CATALOG.map(async model => ({
      id: model.id,
      downloaded: await isModelDownloaded(model),
    })),
  );
  return new Set(results.filter(r => r.downloaded).map(r => r.id));
}

export async function deleteModel(model: ModelEntry): Promise<void> {
  const path = localPathForModel(model);
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
}

export type DownloadProgress = {
  bytesWritten: number;
  contentLength: number;
  fraction: number; // 0..1, or -1 if contentLength is unknown
};

export type ActiveDownload = {
  jobId: number;
  promise: Promise<void>;
};

/**
 * Downloads a model's .gguf file to a temp path, then atomically moves it
 * into place. Downloading to a temp file first means an interrupted
 * download never leaves a corrupt file where the app thinks a model is
 * ready to use.
 */
export function startModelDownload(
  model: ModelEntry,
  onProgress: (progress: DownloadProgress) => void,
): ActiveDownload {
  const finalPath = localPathForModel(model);
  const tmpPath = `${finalPath}.part`;

  const { jobId, promise } = RNFS.downloadFile({
    fromUrl: getModelDownloadUrl(model),
    toFile: tmpPath,
    background: true,
    progressDivider: 1,
    progress: (res: DownloadProgressCallbackResultT) => {
      const contentLength = res.contentLength || 0;
      onProgress({
        bytesWritten: res.bytesWritten,
        contentLength,
        fraction: contentLength > 0 ? res.bytesWritten / contentLength : -1,
      });
    },
  });

  const wrapped = (async () => {
    await ensureModelsDir();
    const result = await promise;
    if (result.statusCode && result.statusCode >= 400) {
      // Clean up the partial file so a retry starts fresh.
      if (await RNFS.exists(tmpPath)) {
        await RNFS.unlink(tmpPath);
      }
      throw new Error(
        `Download failed (HTTP ${result.statusCode}). The model file may have moved on Hugging Face — check the catalog entry's repo page.`,
      );
    }
    if (await RNFS.exists(finalPath)) {
      await RNFS.unlink(finalPath);
    }
    await RNFS.moveFile(tmpPath, finalPath);
  })();

  return { jobId, promise: wrapped };
}

export function cancelDownload(jobId: number): void {
  RNFS.stopDownload(jobId);
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exp);
  return `${value.toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}
