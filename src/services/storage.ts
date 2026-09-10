import * as RNFS from '@dr.pogodin/react-native-fs';
import { DocKit, StorageOption } from '../native/DocKit';

/**
 * Where model files live.
 *
 * The app used to keep every .gguf in its own private folder. That is the
 * worst place for them: multi-gigabyte files that no other app can see, that
 * a file manager cannot reach, and that vanish on uninstall. Anyone running a
 * second local-AI app ends up with two copies of the same weights.
 *
 * So models now go in a plain shared folder — /AIModels on internal storage
 * by default — and the location is a setting. Point another app at the same
 * folder and both load the same file. The app-private folder is still there
 * as the last fallback for a phone where nothing else is writable.
 *
 * Only the model files move. The registry, settings and conversations stay in
 * app storage, where they belong: they are small, private, and nobody else
 * has any business reading them.
 */

const PREF_PATH = `${RNFS.DocumentDirectoryPath}/storage.json`;

/** The pre-2.1 location, kept so old installs can be migrated out of it. */
export const LEGACY_MODELS_DIR = `${RNFS.DocumentDirectoryPath}/models`;

export type StoragePref = {
  /** Absolute path the user chose, if any. */
  dirPath?: string;
  optionId?: string;
  /** Set once the user has seen the storage explainer. */
  reviewed?: boolean;
};

export type ResolvedStorage = {
  dir: string;
  option?: StorageOption;
  /** True when the folder is readable by other apps. */
  shared: boolean;
  /** Set when the chosen folder could not be used and something else was. */
  fallbackReason?: string;
};

let cached: ResolvedStorage | null = null;
let pendingResolve: Promise<ResolvedStorage> | null = null;

export async function loadStoragePref(): Promise<StoragePref> {
  try {
    if (await RNFS.exists(PREF_PATH)) {
      return JSON.parse(await RNFS.readFile(PREF_PATH, 'utf8')) as StoragePref;
    }
  } catch {
    // Unreadable preference — treat it as unset rather than failing to start.
  }
  return {};
}

export async function saveStoragePref(patch: Partial<StoragePref>): Promise<void> {
  const next = { ...(await loadStoragePref()), ...patch };
  await RNFS.writeFile(PREF_PATH, JSON.stringify(next), 'utf8').catch(() => {});
  cached = null;
}

export async function listStorageOptions(): Promise<StorageOption[]> {
  return DocKit.getStorageOptions();
}

/**
 * The folder models are read from and written to right now.
 *
 * Order of preference: what the user picked, then the best shared folder the
 * app can actually write to, then its own external folder, then private
 * storage. Every step is verified by writing a byte — a folder that only
 * looks writable is not good enough when the next step is a 3 GB download.
 */
export async function resolveModelsDir(force = false): Promise<ResolvedStorage> {
  if (cached && !force) return cached;
  if (pendingResolve && !force) return pendingResolve;

  pendingResolve = (async () => {
    const pref = await loadStoragePref();
    const options = await listStorageOptions();

    const byPath = (p?: string) => options.find(o => o.path === p);

    if (pref.dirPath) {
      const check = await DocKit.ensureDir(pref.dirPath);
      if (check.ok) {
        const option = byPath(pref.dirPath);
        return {
          dir: pref.dirPath,
          option,
          shared: option?.shared ?? pref.dirPath.startsWith('/storage/emulated/0/'),
        };
      }
      const fallback = await firstUsable(options);
      return {
        ...fallback,
        fallbackReason:
          check.message ??
          'Your chosen models folder is not writable right now, so the app folder is being used instead.',
      };
    }

    return firstUsable(options);
  })();

  try {
    cached = await pendingResolve;
    return cached;
  } finally {
    pendingResolve = null;
  }
}

async function firstUsable(options: StorageOption[]): Promise<ResolvedStorage> {
  const order = [
    ...options.filter(o => o.shared && o.writable && !o.removable),
    ...options.filter(o => o.shared && o.writable && o.removable),
    ...options.filter(o => !o.shared && o.id === 'app-external'),
    ...options.filter(o => !o.shared),
  ];
  for (const option of order) {
    const check = await DocKit.ensureDir(option.path);
    if (check.ok) return { dir: option.path, option, shared: option.shared };
  }
  // Nothing native answered — Jest, or a device in a very strange state.
  await RNFS.mkdir(LEGACY_MODELS_DIR).catch(() => {});
  return { dir: LEGACY_MODELS_DIR, shared: false };
}

/** Switches folders. Returns null on success, or why it could not be used. */
export async function setModelsDir(
  path: string,
  optionId?: string,
): Promise<string | null> {
  const check = await DocKit.ensureDir(path);
  if (!check.ok) return check.message ?? 'That folder cannot be written to.';
  await saveStoragePref({ dirPath: path, optionId, reviewed: true });
  cached = null;
  await resolveModelsDir(true);
  return null;
}

export type MigrationProgress = {
  file: string;
  index: number;
  total: number;
};

export type MigrationResult = {
  moved: string[];
  failed: Array<{ file: string; message: string }>;
};

/**
 * Moves every .gguf from one folder to another, one file at a time.
 *
 * Copy-then-delete rather than a rename when the two are on different
 * volumes, and the source is only removed after the copy is verified by
 * size — losing a 3 GB download to a half-written move would be
 * unforgivable.
 */
export async function migrateModels(
  from: string,
  to: string,
  onProgress?: (p: MigrationProgress) => void,
): Promise<MigrationResult> {
  const result: MigrationResult = { moved: [], failed: [] };
  if (from === to) return result;

  const files = await DocKit.listGguf(from);
  const check = await DocKit.ensureDir(to);
  if (!check.ok) {
    return {
      moved: [],
      failed: files.map(f => ({
        file: f.name,
        message: check.message ?? 'Destination not writable.',
      })),
    };
  }

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress?.({ file: f.name, index: i, total: files.length });
    try {
      await DocKit.moveFile(f.path, `${to}/${f.name}`);
      result.moved.push(f.name);
    } catch (e: any) {
      result.failed.push({
        file: f.name,
        message: e?.message ?? 'Move failed.',
      });
    }
  }
  return result;
}

/** How much of the old app-private folder is still sitting there. */
export async function legacyLeftovers(): Promise<{ count: number; bytes: number }> {
  const files = await DocKit.listGguf(LEGACY_MODELS_DIR);
  return {
    count: files.length,
    bytes: files.reduce((n, f) => n + f.size, 0),
  };
}

export function invalidateStorageCache() {
  cached = null;
}
