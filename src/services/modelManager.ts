import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  DocKit,
  onDownloadDone,
  onDownloadError,
  onDownloadProgress,
} from '../native/DocKit';
import {
  ModelEntry,
  getMmprojDownloadUrl,
  getModelById,
  getModelDownloadUrl,
  resolveCurrentFilename,
} from '../data/modelCatalog';

export const MODELS_DIR = `${RNFS.DocumentDirectoryPath}/models`;
const REGISTRY_PATH = `${MODELS_DIR}/installed.json`;

/**
 * A model the app can actually load right now, wherever it came from:
 * downloaded in-app, imported from Downloads, or referenced in place on
 * external storage.
 */
export type InstalledModel = {
  /** Catalog id, or `custom:<something>` for a hand-imported file. */
  id: string;
  label: string;
  /** Real filesystem path. Never a content:// URI — llama.cpp can't mmap those. */
  path: string;
  mmprojPath?: string;
  sizeBytes: number;
  contextSize: number;
  /** True when the file lives outside the app and shouldn't be deleted by us. */
  external: boolean;
  addedAt: number;
};

type Registry = { models: InstalledModel[] };

export async function ensureModelsDir(): Promise<void> {
  if (!(await RNFS.exists(MODELS_DIR))) {
    await RNFS.mkdir(MODELS_DIR);
  }
}

export async function readRegistry(): Promise<InstalledModel[]> {
  try {
    await ensureModelsDir();
    if (!(await RNFS.exists(REGISTRY_PATH))) return [];
    const raw = await RNFS.readFile(REGISTRY_PATH, 'utf8');
    const parsed: Registry = JSON.parse(raw);
    // Drop entries whose file has since been deleted or moved.
    const alive: InstalledModel[] = [];
    for (const m of parsed.models ?? []) {
      if (await RNFS.exists(m.path)) alive.push(m);
    }
    if (alive.length !== (parsed.models ?? []).length) await writeRegistry(alive);
    return alive;
  } catch {
    return [];
  }
}

async function writeRegistry(models: InstalledModel[]): Promise<void> {
  await ensureModelsDir();
  await RNFS.writeFile(REGISTRY_PATH, JSON.stringify({ models }), 'utf8');
}

export async function upsertInstalled(model: InstalledModel): Promise<InstalledModel[]> {
  const current = await readRegistry();
  const next = [...current.filter(m => m.id !== model.id), model].sort(
    (a, b) => b.addedAt - a.addedAt,
  );
  await writeRegistry(next);
  return next;
}

export async function removeInstalled(id: string): Promise<InstalledModel[]> {
  const current = await readRegistry();
  const target = current.find(m => m.id === id);
  if (target && !target.external) {
    // Only delete files we put there ourselves. Anything the user placed
    // in Downloads stays exactly where they left it.
    for (const p of [target.path, target.mmprojPath]) {
      if (p && (await RNFS.exists(p))) {
        try {
          await RNFS.unlink(p);
        } catch {
          // Best effort — a locked file shouldn't block deregistration.
        }
      }
    }
  }
  const next = current.filter(m => m.id !== id);
  await writeRegistry(next);
  return next;
}

export function localPathFor(modelId: string, filename: string): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${MODELS_DIR}/${modelId}__${safe}`;
}

// -------------------------------------------------------------------
// Downloading
// -------------------------------------------------------------------

export type DownloadStatus = {
  jobId: string;
  modelId: string;
  /** Which of the (up to two) files is in flight. */
  part: 'model' | 'mmproj';
  written: number;
  total: number;
  state: 'running' | 'paused' | 'error' | 'done';
  message?: string;
};

type Job = {
  jobId: string;
  modelId: string;
  part: 'model' | 'mmproj';
  url: string;
  destPath: string;
};

const jobs = new Map<string, Job>();
let listenersAttached = false;
const subscribers = new Set<(s: DownloadStatus) => void>();

export function subscribeDownloads(cb: (s: DownloadStatus) => void): () => void {
  subscribers.add(cb);
  attachListeners();
  return () => subscribers.delete(cb);
}

function publish(s: DownloadStatus) {
  subscribers.forEach(cb => cb(s));
}

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  onDownloadProgress(e => {
    const job = jobs.get(e.id);
    if (!job) return;
    publish({
      jobId: e.id,
      modelId: job.modelId,
      part: job.part,
      written: e.written,
      total: e.total,
      state: 'running',
    });
  });

  onDownloadDone(async e => {
    const job = jobs.get(e.id);
    if (!job) return;
    jobs.delete(e.id);
    publish({
      jobId: e.id,
      modelId: job.modelId,
      part: job.part,
      written: e.size,
      total: e.size,
      state: 'done',
    });
  });

  onDownloadError(e => {
    const job = jobs.get(e.id);
    if (!job) return;
    publish({
      jobId: e.id,
      modelId: job.modelId,
      part: job.part,
      written: 0,
      total: 0,
      state: 'error',
      message: e.resumable
        ? `${e.message} The partial file was kept, so resuming won't start over.`
        : e.message,
    });
  });
}

/**
 * Starts (or resumes) the download of one file. Resuming is automatic:
 * the native side sends a Range header when a .part file is already
 * present, so a dropped connection costs you seconds, not gigabytes.
 */
export async function startDownload(
  model: ModelEntry,
  part: 'model' | 'mmproj',
): Promise<string> {
  await ensureModelsDir();
  attachListeners();

  let filename = part === 'model' ? model.filename : model.mmproj?.filename;
  if (!filename) throw new Error('That model has no projector file.');
  let url =
    part === 'model' ? getModelDownloadUrl(model) : getMmprojDownloadUrl(model)!;

  // If the published filename has gone stale, ask the repo what it holds
  // now rather than failing with a 404 the user can do nothing about.
  const head = await headOk(url);
  if (!head) {
    const resolved = await resolveCurrentFilename(model, part === 'mmproj');
    if (resolved) {
      filename = resolved;
      url = `https://huggingface.co/${model.repo}/resolve/main/${resolved}?download=true`;
    }
  }

  const destPath = localPathFor(model.id, filename);
  const jobId = `${model.id}:${part}`;
  jobs.set(jobId, { jobId, modelId: model.id, part, url, destPath });
  DocKit.startDownload(jobId, url, destPath);
  return jobId;
}

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return true; // offline or blocked — assume the catalog entry is fine
  }
}

export function pauseDownload(jobId: string) {
  DocKit.pauseDownload(jobId);
  const job = jobs.get(jobId);
  jobs.delete(jobId);
  if (job) {
    publish({
      jobId,
      modelId: job.modelId,
      part: job.part,
      written: 0,
      total: 0,
      state: 'paused',
    });
  }
}

export function cancelDownload(jobId: string) {
  const job = jobs.get(jobId);
  if (job) DocKit.cancelDownload(jobId, job.destPath);
  jobs.delete(jobId);
}

/** How much of a paused/failed transfer is already on disk. */
export async function resumableBytes(
  model: ModelEntry,
  part: 'model' | 'mmproj',
): Promise<number> {
  const filename = part === 'model' ? model.filename : model.mmproj?.filename;
  if (!filename) return 0;
  return DocKit.partialSize(localPathFor(model.id, filename));
}

/**
 * Once both required files exist on disk, register the model so it can be
 * loaded. Returns null while something is still missing.
 */
export async function finalizeCatalogModel(
  modelId: string,
): Promise<InstalledModel | null> {
  const model = getModelById(modelId);
  if (!model) return null;

  const modelPath = localPathFor(model.id, model.filename);
  if (!(await RNFS.exists(modelPath))) return null;

  let mmprojPath: string | undefined;
  if (model.mmproj) {
    const p = localPathFor(model.id, model.mmproj.filename);
    if (!(await RNFS.exists(p))) return null;
    mmprojPath = p;
  }

  const stat = await RNFS.stat(modelPath);
  const installed: InstalledModel = {
    id: model.id,
    label: model.label,
    path: modelPath,
    mmprojPath,
    sizeBytes: Number(stat.size) || 0,
    contextSize: model.recommendedContext,
    external: false,
    addedAt: Date.now(),
  };
  await upsertInstalled(installed);
  return installed;
}

// -------------------------------------------------------------------
// Importing files the user obtained themselves
// -------------------------------------------------------------------

export type ImportResult = {
  installed: InstalledModel;
  /** True when the file was copied into app storage rather than used in place. */
  copied: boolean;
};

/**
 * Brings a .gguf the user already has into the app.
 *
 * Preference order matters. Using the file where it sits costs no extra
 * storage, so that's tried first — but it only works when the app can
 * resolve a real path, since llama.cpp mmaps by path and revalidates
 * permissions against the symlink target. Failing that, we copy.
 */
export async function importModelFromUri(
  uri: string,
  displayName: string,
  opts: { forceCopy?: boolean; mmprojUri?: string; mmprojName?: string } = {},
): Promise<ImportResult> {
  await ensureModelsDir();
  const id = `custom:${displayName.replace(/\.gguf$/i, '')}`;

  let path: string | null = null;
  let copied = false;

  if (!opts.forceCopy) {
    path = await DocKit.resolveRealPath(uri);
  }
  if (!path) {
    path = await DocKit.copyToModels(uri, displayName, MODELS_DIR);
    copied = true;
  }

  let mmprojPath: string | undefined;
  if (opts.mmprojUri && opts.mmprojName) {
    mmprojPath =
      (await DocKit.resolveRealPath(opts.mmprojUri)) ??
      (await DocKit.copyToModels(opts.mmprojUri, opts.mmprojName, MODELS_DIR));
  }

  const stat = await RNFS.stat(path);
  const installed: InstalledModel = {
    id,
    label: displayName.replace(/\.gguf$/i, ''),
    path,
    mmprojPath,
    sizeBytes: Number(stat.size) || 0,
    contextSize: 8192,
    external: !copied,
    addedAt: Date.now(),
  };
  await upsertInstalled(installed);
  return { installed, copied };
}

/** Registers a .gguf found by scanning storage, using it in place. */
export async function importScannedModel(
  filePath: string,
  name: string,
  mmprojPath?: string,
): Promise<InstalledModel> {
  const stat = await RNFS.stat(filePath);
  const installed: InstalledModel = {
    id: `custom:${name.replace(/\.gguf$/i, '')}`,
    label: name.replace(/\.gguf$/i, ''),
    path: filePath,
    mmprojPath,
    sizeBytes: Number(stat.size) || 0,
    contextSize: 8192,
    external: true,
    addedAt: Date.now(),
  };
  await upsertInstalled(installed);
  return installed;
}

// -------------------------------------------------------------------

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exp);
  return `${value.toFixed(exp <= 1 ? 0 : 1)} ${units[exp]}`;
}
