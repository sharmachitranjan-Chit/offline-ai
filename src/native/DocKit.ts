import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

/**
 * Typed access to the DocKit native module.
 *
 * Every method degrades gracefully when the native side isn't there
 * (Jest, or a future iOS build) so the UI never crashes just because a
 * capability is missing — it simply reports that capability as absent.
 */

export type PickedFile = {
  uri: string;
  name: string;
  size: number;
  mime: string;
};

export type PreparedAttachment = {
  kind: 'image' | 'pdf' | 'document' | 'text';
  name: string;
  mime: string;
  size: number;
  uri: string;
  /** Local filesystem path — images only. */
  path?: string;
  /** Extracted plain text — PDFs with a text layer, office docs, text files. */
  text?: string;
  /** Rendered page images — scanned PDFs with no text layer. */
  pageImages?: string[];
  previewPath?: string;
  pageCount?: number;
  hasTextLayer?: boolean;
};

export type ScannedModelFile = {
  path: string;
  name: string;
  size: number;
  isMmproj: boolean;
};

export type DeviceInfo = {
  totalRamBytes: number;
  availRamBytes: number;
  cores: number;
  model: string;
  sdk: number;
  downloadsDir: string;
  freeDiskBytes: number;
};

type DocKitNative = {
  pickFiles(o: { mimeTypes: string[]; multiple: boolean }): Promise<PickedFile[]>;
  prepareAttachment(
    uri: string,
    o: { maxImageDim?: number; maxChars?: number; maxPdfPages?: number },
  ): Promise<PreparedAttachment>;
  resolveRealPath(uri: string): Promise<string | null>;
  startDownload(id: string, url: string, destPath: string): void;
  pauseDownload(id: string): void;
  cancelDownload(id: string, destPath: string): void;
  partialSize(destPath: string): Promise<number>;
  scanForModels(): Promise<ScannedModelFile[]>;
  copyToModels(uri: string, fileName: string, destDir: string): Promise<string>;
  setClipboard(text: string): void;
  openUrl(url: string): Promise<boolean>;
  setImmersive(enabled: boolean): void;
  setKeepScreenOn(enabled: boolean): void;
  getDeviceInfo(): Promise<DeviceInfo>;
  hasAllFilesAccess(): Promise<boolean>;
  requestAllFilesAccess(): Promise<boolean>;
};

const native: Partial<DocKitNative> = NativeModules.DocKit ?? {};

export const isDocKitAvailable = !!NativeModules.DocKit;

const emitter = isDocKitAvailable
  ? new NativeEventEmitter(NativeModules.DocKit)
  : null;

export type DownloadProgressEvent = {
  id: string;
  written: number;
  total: number;
};
export type DownloadDoneEvent = { id: string; path: string; size: number };
export type DownloadErrorEvent = {
  id: string;
  message: string;
  resumable: boolean;
};

type Sub = { remove(): void };
const NO_SUB: Sub = { remove() {} };

function listen<T>(event: string, cb: (e: T) => void): Sub {
  return (
    emitter?.addListener(event, (payload: unknown) => cb(payload as T)) ?? NO_SUB
  );
}

export const onDownloadProgress = (cb: (e: DownloadProgressEvent) => void) =>
  listen('DocKitDownloadProgress', cb);
export const onDownloadDone = (cb: (e: DownloadDoneEvent) => void) =>
  listen('DocKitDownloadDone', cb);
export const onDownloadError = (cb: (e: DownloadErrorEvent) => void) =>
  listen('DocKitDownloadError', cb);

const unavailable = (what: string) =>
  new Error(
    `${what} needs the native DocKit module, which isn't available on ${Platform.OS}.`,
  );

export const DocKit = {
  available: isDocKitAvailable,

  async pickFiles(mimeTypes: string[], multiple = true): Promise<PickedFile[]> {
    if (!native.pickFiles) throw unavailable('Picking files');
    return native.pickFiles({ mimeTypes, multiple });
  },

  async prepareAttachment(
    uri: string,
    opts: { maxImageDim?: number; maxChars?: number; maxPdfPages?: number } = {},
  ): Promise<PreparedAttachment> {
    if (!native.prepareAttachment) throw unavailable('Reading attachments');
    return native.prepareAttachment(uri, opts);
  },

  async resolveRealPath(uri: string): Promise<string | null> {
    if (!native.resolveRealPath) return null;
    try {
      return await native.resolveRealPath(uri);
    } catch {
      return null;
    }
  },

  startDownload(id: string, url: string, destPath: string) {
    native.startDownload?.(id, url, destPath);
  },
  pauseDownload(id: string) {
    native.pauseDownload?.(id);
  },
  cancelDownload(id: string, destPath: string) {
    native.cancelDownload?.(id, destPath);
  },
  async partialSize(destPath: string): Promise<number> {
    try {
      return (await native.partialSize?.(destPath)) ?? 0;
    } catch {
      return 0;
    }
  },

  async scanForModels(): Promise<ScannedModelFile[]> {
    try {
      return (await native.scanForModels?.()) ?? [];
    } catch {
      return [];
    }
  },

  async copyToModels(uri: string, fileName: string, destDir: string) {
    if (!native.copyToModels) throw unavailable('Importing a model');
    return native.copyToModels(uri, fileName, destDir);
  },

  setClipboard(text: string) {
    native.setClipboard?.(text);
  },
  async openUrl(url: string) {
    try {
      return (await native.openUrl?.(url)) ?? false;
    } catch {
      return false;
    }
  },
  setImmersive(enabled: boolean) {
    native.setImmersive?.(enabled);
  },
  setKeepScreenOn(enabled: boolean) {
    native.setKeepScreenOn?.(enabled);
  },
  async getDeviceInfo(): Promise<DeviceInfo | null> {
    try {
      return (await native.getDeviceInfo?.()) ?? null;
    } catch {
      return null;
    }
  },
  async hasAllFilesAccess(): Promise<boolean> {
    try {
      return (await native.hasAllFilesAccess?.()) ?? false;
    } catch {
      return false;
    }
  },
  async requestAllFilesAccess(): Promise<boolean> {
    try {
      return (await native.requestAllFilesAccess?.()) ?? false;
    } catch {
      return false;
    }
  },
};

/** MIME filters used by the composer's attach button. */
export const PICK_ANY = [
  'image/*',
  'application/pdf',
  'text/*',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
export const PICK_IMAGE = ['image/*'];
export const PICK_GGUF = ['application/octet-stream', '*/*'];
