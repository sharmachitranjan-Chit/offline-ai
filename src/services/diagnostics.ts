import * as RNFS from '@dr.pogodin/react-native-fs';

/**
 * A small, always-on diagnostics log.
 *
 * The point isn't to be a full crash-reporting SDK — it's to turn "the app
 * crashed, I don't know why" into a log the user can copy out and hand
 * over, so a fix can be made from evidence instead of a guess. Everything
 * here stays on-device; nothing is ever transmitted.
 */

const LOG_PATH = `${RNFS.DocumentDirectoryPath}/diagnostics.log`;
/** Rolled over once the log passes this size, so it can never grow without bound. */
const MAX_BYTES = 400 * 1024;

let queue: Promise<void> = Promise.resolve();
let installed = false;

function stamp(): string {
  return new Date().toISOString();
}

function serialize(details: unknown): string {
  if (details === undefined) return '';
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

/** Appends one line. Fire-and-forget, but calls are serialized so lines never interleave. */
export function logEvent(tag: string, details?: unknown): void {
  const line = `[${stamp()}] ${tag}${details !== undefined ? ' ' + serialize(details) : ''}\n`;
  queue = queue
    .then(async () => {
      try {
        const exists = await RNFS.exists(LOG_PATH);
        if (exists) {
          const stat = await RNFS.stat(LOG_PATH);
          if (Number(stat.size) > MAX_BYTES) {
            // Keep the second half rather than wiping it — recent history
            // matters far more than the oldest lines.
            const current = await RNFS.readFile(LOG_PATH, 'utf8');
            await RNFS.writeFile(
              LOG_PATH,
              current.slice(Math.floor(current.length / 2)),
              'utf8',
            );
          }
        }
        await RNFS.appendFile(LOG_PATH, line, 'utf8');
      } catch {
        // A logging failure must never be the thing that crashes the app.
      }
    })
    .catch(() => {});
}

export async function readLog(): Promise<string> {
  try {
    if (!(await RNFS.exists(LOG_PATH))) return '(no diagnostics recorded yet)';
    return await RNFS.readFile(LOG_PATH, 'utf8');
  } catch {
    return '(could not read the diagnostics log)';
  }
}

export async function clearLog(): Promise<void> {
  try {
    if (await RNFS.exists(LOG_PATH)) await RNFS.unlink(LOG_PATH);
  } catch {
    // Ignore — worst case the old log just stays around.
  }
}

/**
 * Wires up global handlers so a crash actually leaves a trace: uncaught JS
 * exceptions and unhandled promise rejections both get written to the log
 * before whatever RN's own error UI does with them. Call this once, as
 * early as possible.
 */
export function installGlobalCrashLogging(): void {
  if (installed) return;
  installed = true;

  logEvent('app_start');

  const g: any = globalThis;
  const prevHandler =
    g.ErrorUtils && typeof g.ErrorUtils.getGlobalHandler === 'function'
      ? g.ErrorUtils.getGlobalHandler()
      : null;

  if (g.ErrorUtils && typeof g.ErrorUtils.setGlobalHandler === 'function') {
    g.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      logEvent(isFatal ? 'fatal_js_error' : 'js_error', {
        message: error?.message,
        stack: error?.stack,
      });
      prevHandler?.(error, isFatal);
    });
  }

  // React Native's promise polyfill supports this rejection tracker. It's
  // wrapped in a try/catch because it isn't guaranteed to be present on
  // every RN version, and a missing optional diagnostic must never be
  // fatal on its own.
  try {
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (id: number, error: any) => {
        logEvent('unhandled_promise_rejection', {
          message: error?.message ?? String(error),
          stack: error?.stack,
        });
      },
    });
  } catch {
    // No rejection tracker available on this RN version — fine.
  }
}
