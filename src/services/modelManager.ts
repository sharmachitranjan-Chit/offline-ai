import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  DocKit,
  ScannedModelFile,
  onDownloadDone,
  onDownloadError,
  onDownloadProgress,
} from '../native/DocKit';
import {
  MODEL_CATALOG,
  ModelEntry,
  downloadUrl,
  getModelById,
  projectorById,
  quantById,
  resolveCurrentFilename,
} from '../data/modelCatalog';
import {
  LEGACY_MODELS_DIR,
  resolveModelsDir,
  invalidateStorageCache,
} from './storage';

/**
 * Installed models: what is on disk, where, and how to get more.
 *
 * The important change from earlier versions is that model files are no
 * longer kept inside the app. They go to a shared folder (see storage.ts) and
 * keep their published filenames, so another app on the phone can load the
 * same file. What stays private is this registry — a small index of what the
 * app knows about, held in app storage where it cannot clutter the user's
 * file manager.
 *
 * Because the folder is shared, it is also treated as the source of truth:
 * anything dropped in by hand, by a browser or by another app is picked up on
 * the next refresh without an import step.
 */

const REGISTRY_PATH = `${RNFS.DocumentDirectoryPath}/installed.json`;
const LEGACY_REGISTRY_PATH = `${LEGACY_MODELS_DIR}/installed.json`;

export type InstalledModel = {
  /** Catalog id, or `custom:<filename>` for anything found or imported. */
  id: string;
  label: string;
  /** Real filesystem path. Never a content:// URI — llama.cpp can't mmap those. */
  path: string;
  mmprojPath?: string;
  sizeBytes: number;
  contextSize: number;
  /** Which quantisation, when it came from the catalog. */
  quantId?: string;
  /** True when the file lives outside the managed folder — never deleted by us. */
  external: boolean;
  addedAt: number;
};

type Registry = { models: InstalledModel[] };

export async function getModelsDir(): Promise<string> {
  return (await resolveModelsDir()).dir;
}

// -------------------------------------------------------------------
// Naming
// -------------------------------------------------------------------

/**
 * Files keep the name they were published under, because a shared folder
 * full of `gemma-3-4b-it__abc.gguf` is worse than useless to another app.
 *
 * The exception is projectors: several repos ship theirs as plain
 * `mmproj-F16.gguf`, and two of those in one folder would collide. Those get
 * the model id in front; anything already distinctive is left alone.
 */
const GENERIC_MMPROJ = /^mmproj[-_.]?(model)?[-_.]?(f16|f32|bf16|q8_0|fp16)?\.gguf$/i;

export function storedFilename(modelId: string, filename: string): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, '_');
  if (GENERIC_MMPROJ.test(safe)) {
    return `${modelId.replace(/[^A-Za-z0-9._-]/g, '_')}-${safe}`;
  }
  return safe;
}

export async function localPathFor(
  modelId: string,
  filename: string,
): Promise<string> {
  return `${await getModelsDir()}/${storedFilename(modelId, filename)}`;
}

// -------------------------------------------------------------------
// Registry
// -------------------------------------------------------------------

/** The registry as written, without dropping entries whose file is gone. */
async function readRegistryRaw(): Promise<InstalledModel[]> {
  try {
    let raw: string | null = null;
    if (await RNFS.exists(REGISTRY_PATH)) {
      raw = await RNFS.readFile(REGISTRY_PATH, 'utf8');
    } else if (await RNFS.exists(LEGACY_REGISTRY_PATH)) {
      raw = await RNFS.readFile(LEGACY_REGISTRY_PATH, 'utf8');
    }
    return raw ? ((JSON.parse(raw) as Registry).models ?? []) : [];
  } catch {
    return [];
  }
}

export async function readRegistry(): Promise<InstalledModel[]> {
  try {
    let raw: string | null = null;
    if (await RNFS.exists(REGISTRY_PATH)) {
      raw = await RNFS.readFile(REGISTRY_PATH, 'utf8');
    } else if (await RNFS.exists(LEGACY_REGISTRY_PATH)) {
      // Upgrading from a version that kept its index beside the models.
      raw = await RNFS.readFile(LEGACY_REGISTRY_PATH, 'utf8');
    }
    if (!raw) return [];

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
  await RNFS.writeFile(REGISTRY_PATH, JSON.stringify({ models }), 'utf8').catch(
    () => {},
  );
}

export async function upsertInstalled(
  model: InstalledModel,
): Promise<InstalledModel[]> {
  const current = await readRegistry();
  const next = [...current.filter(m => m.id !== model.id), model].sort(
    (a, b) => b.addedAt - a.addedAt,
  );
  await writeRegistry(next);
  return next;
}

/**
 * Forgets a model, and optionally deletes the file.
 *
 * These are deliberately separate. The folder is shared, so a file this app
 * did not download may well be in use by another app — quietly deleting it
 * because someone tapped "remove" here would be a nasty surprise.
 */
export async function removeInstalled(
  id: string,
  deleteFiles: boolean,
): Promise<InstalledModel[]> {
  const current = await readRegistry();
  const target = current.find(m => m.id === id);
  if (target && deleteFiles && !target.external) {
    for (const p of [target.path, target.mmprojPath]) {
      if (p) await DocKit.deleteFile(p);
    }
  }
  const next = current.filter(m => m.id !== id);
  await writeRegistry(next);
  return next;
}

// -------------------------------------------------------------------
// Discovery — anything sitting in the models folder counts
// -------------------------------------------------------------------

/** Match a file on disk back to a catalog entry, by published filename. */
function catalogMatch(
  fileName: string,
): { model: ModelEntry; quantId: string } | undefined {
  for (const model of MODEL_CATALOG) {
    for (const q of model.quants) {
      if (
        storedFilename(model.id, q.filename).toLowerCase() ===
        fileName.toLowerCase()
      ) {
        return { model, quantId: q.id };
      }
    }
  }
  return undefined;
}

/** Best guess at which projector belongs to which model file. */
function pairProjector(
  file: ScannedModelFile,
  projectors: ScannedModelFile[],
  catalog?: { model: ModelEntry; quantId: string },
): string | undefined {
  if (!projectors.length) return undefined;

  if (catalog?.model.mmproj) {
    for (const p of catalog.model.mmproj) {
      const want = storedFilename(catalog.model.id, p.filename).toLowerCase();
      const hit = projectors.find(x => x.name.toLowerCase() === want);
      if (hit) return hit.path;
    }
  }

  // Otherwise fall back to the longest shared prefix, which handles
  // "Foo-Q4_K_M.gguf" next to "mmproj-Foo-f16.gguf" and its variants.
  const stem = file.name
    .toLowerCase()
    .replace(/\.gguf$/, '')
    .replace(/[-_.](q\d[^-_.]*|f16|f32|bf16|iq\d[^-_.]*|ud)$/g, '');
  const token = stem.split(/[-_.]/).filter(t => t.length > 2)[0] ?? stem;
  return projectors.find(p => p.name.toLowerCase().includes(token))?.path;
}

function labelFor(fileName: string): string {
  return fileName
    .replace(/\.gguf$/i, '')
    .replace(/[-_.](Q\d[^-_.]*|f16|f32|BF16|IQ\d[^-_.]*|UD)$/gi, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

/**
 * Reconciles the registry with what is actually in the models folder.
 *
 * This is what makes a shared folder pleasant to use: drop a .gguf in from a
 * browser, a download manager or another AI app, open this one, and it is
 * simply there. No import step, no picker, no copy.
 */
export async function syncWithFolder(): Promise<InstalledModel[]> {
  const dir = await getModelsDir();
  const found = await DocKit.listGguf(dir);
  const registry = await readRegistry();

  const projectors = found.filter(f => f.isMmproj);
  const known = new Set(registry.map(m => m.path));
  const added: InstalledModel[] = [];

  for (const file of found) {
    if (file.isMmproj || known.has(file.path)) continue;

    const catalog = catalogMatch(file.name);
    const mmprojPath = pairProjector(file, projectors, catalog);

    added.push({
      id: catalog ? catalog.model.id : `custom:${file.name}`,
      label: catalog ? catalog.model.label : labelFor(file.name),
      path: file.path,
      mmprojPath,
      sizeBytes: file.size,
      contextSize: catalog?.model.recommendedContext ?? 8192,
      quantId: catalog?.quantId,
      external: false,
      addedAt: Date.now(),
    });
  }

  if (!added.length) return registry;

  // A catalog id that is already registered elsewhere (say the same model
  // imported from another folder) keeps the newer file.
  const merged = [
    ...registry.filter(m => !added.some(a => a.id === m.id)),
    ...added,
  ].sort((a, b) => b.addedAt - a.addedAt);
  await writeRegistry(merged);
  return merged;
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
  quantId?: string;
  projectorId?: string;
};

const jobs = new Map<string, Job>();
let listenersAttached = false;
const subscribers = new Set<(s: DownloadStatus) => void>();

export function subscribeDownloads(cb: (s: DownloadStatus) => void): () => void {
  subscribers.add(cb);
  attachListeners();
  return () => {
    subscribers.delete(cb);
  };
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

export type DownloadChoice = { quantId?: string; projectorId?: string };

/**
 * Starts (or resumes) the download of one file. Resuming is automatic: the
 * native side sends a Range header when a .part file is already present, so a
 * dropped connection costs seconds rather than gigabytes.
 */
export async function startDownload(
  model: ModelEntry,
  part: 'model' | 'mmproj',
  choice: DownloadChoice = {},
): Promise<string> {
  attachListeners();

  const quant = quantById(model, choice.quantId);
  const projector = projectorById(model, choice.projectorId);

  let filename = part === 'model' ? quant.filename : projector?.filename;
  if (!filename) throw new Error('That model has no projector file.');
  let url = downloadUrl(model, filename);

  // If the published filename has gone stale, ask the repo what it holds now
  // rather than failing with a 404 the user can do nothing about.
  if (!(await headOk(url))) {
    const resolved = await resolveCurrentFilename(model, part === 'mmproj');
    if (resolved) {
      filename = resolved;
      url = downloadUrl(model, resolved);
    }
  }

  const destPath = await localPathFor(model.id, filename);
  const jobId = `${model.id}:${part}`;
  jobs.set(jobId, {
    jobId,
    modelId: model.id,
    part,
    url,
    destPath,
    quantId: quant.id,
    projectorId: projector?.id,
  });
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

/** How much of a paused or failed transfer is already on disk. */
export async function resumableBytes(
  model: ModelEntry,
  part: 'model' | 'mmproj',
  choice: DownloadChoice = {},
): Promise<number> {
  const filename =
    part === 'model'
      ? quantById(model, choice.quantId).filename
      : projectorById(model, choice.projectorId)?.filename;
  if (!filename) return 0;
  return DocKit.partialSize(await localPathFor(model.id, filename));
}

/**
 * Once both required files exist on disk, register the model so it can be
 * loaded. Returns null while something is still missing.
 */
export async function finalizeCatalogModel(
  modelId: string,
  choice: DownloadChoice = {},
): Promise<InstalledModel | null> {
  const model = getModelById(modelId);
  if (!model) return null;

  const quant = quantById(model, choice.quantId);
  const modelPath = await localPathFor(model.id, quant.filename);
  if (!(await RNFS.exists(modelPath))) return null;

  let mmprojPath: string | undefined;
  const projector = projectorById(model, choice.projectorId);
  if (projector) {
    const p = await localPathFor(model.id, projector.filename);
    if (!(await RNFS.exists(p))) return null;
    mmprojPath = p;
  }

  const stat = await RNFS.stat(modelPath);
  const installed: InstalledModel = {
    id: model.id,
    label: model.label,
    path: modelPath,
    mmprojPath,
    sizeBytes: Number(stat.size) || quant.sizeBytes,
    contextSize: model.recommendedContext,
    quantId: quant.id,
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
  /** True when the file was copied rather than used where it already sat. */
  copied: boolean;
};

/**
 * Brings a .gguf the user already has into the app.
 *
 * Using the file where it sits costs no extra storage, so that is tried
 * first — but it only works when the app can resolve a real path, since
 * llama.cpp mmaps by path and revalidates permissions against the target.
 * Failing that, we copy into the models folder.
 */
export async function importModelFromUri(
  uri: string,
  displayName: string,
  opts: { forceCopy?: boolean; mmprojUri?: string; mmprojName?: string } = {},
): Promise<ImportResult> {
  const dir = await getModelsDir();
  const id = `custom:${displayName}`;

  let path: string | null = null;
  let copied = false;

  if (!opts.forceCopy) {
    path = await DocKit.resolveRealPath(uri);
  }
  if (!path) {
    path = await DocKit.copyToModels(uri, displayName, dir);
    copied = true;
  }

  let mmprojPath: string | undefined;
  if (opts.mmprojUri && opts.mmprojName) {
    mmprojPath =
      (await DocKit.resolveRealPath(opts.mmprojUri)) ??
      (await DocKit.copyToModels(opts.mmprojUri, opts.mmprojName, dir));
  }

  const stat = await RNFS.stat(path);
  const catalog = catalogMatch(displayName);
  const installed: InstalledModel = {
    id: catalog ? catalog.model.id : id,
    label: catalog ? catalog.model.label : labelFor(displayName),
    path,
    mmprojPath,
    sizeBytes: Number(stat.size) || 0,
    contextSize: catalog?.model.recommendedContext ?? 8192,
    quantId: catalog?.quantId,
    external: !path.startsWith(dir),
    addedAt: Date.now(),
  };
  await upsertInstalled(installed);
  return { installed, copied };
}

/** Registers a .gguf found by scanning storage, using it where it sits. */
export async function importScannedModel(
  filePath: string,
  name: string,
  mmprojPath?: string,
): Promise<InstalledModel> {
  const dir = await getModelsDir();
  const stat = await RNFS.stat(filePath);
  const catalog = catalogMatch(name);
  const installed: InstalledModel = {
    id: catalog ? catalog.model.id : `custom:${name}`,
    label: catalog ? catalog.model.label : labelFor(name),
    path: filePath,
    mmprojPath,
    sizeBytes: Number(stat.size) || 0,
    contextSize: catalog?.model.recommendedContext ?? 8192,
    quantId: catalog?.quantId,
    external: !filePath.startsWith(dir),
    addedAt: Date.now(),
  };
  await upsertInstalled(installed);
  return installed;
}

/**
 * Re-points registry entries after the models folder changes, so a migration
 * doesn't leave every installed model looking like it vanished.
 */
export async function repointRegistry(
  fromDir: string,
  toDir: string,
  moves: Array<{ from: string; to: string }> = [],
): Promise<InstalledModel[]> {
  // Must be the raw registry: by now the files have left their old paths,
  // and the filtered read would silently drop every entry being moved —
  // losing their catalog ids (and with that, auto-load of the last model).
  const registry = await readRegistryRaw();
  const exact = new Map(moves.map(m => [m.from, m.to]));
  const next: InstalledModel[] = [];
  for (const m of registry) {
    const repoint = (p?: string) =>
      !p
        ? p
        : exact.get(p) ??
          (p.startsWith(fromDir + '/') ? `${toDir}${p.slice(fromDir.length)}` : p);
    const path = repoint(m.path)!;
    const mmprojPath = repoint(m.mmprojPath);
    if (await RNFS.exists(path)) {
      next.push({ ...m, path, mmprojPath, external: !path.startsWith(toDir) });
    } else if (await RNFS.exists(m.path)) {
      next.push(m);
    }
  }
  await writeRegistry(next);
  invalidateStorageCache();
  return next;
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
