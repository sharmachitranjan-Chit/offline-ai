import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { initLlama, LlamaContext as LlamaCppContext } from 'llama.rn';
import { InstalledModel, readRegistry } from '../services/modelManager';
import { Attachment, planAttachments } from '../services/attachments';
import { DocKit } from '../native/DocKit';
import { logEvent } from '../services/diagnostics';

export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  attachments?: Attachment[];
  /** Content the model emitted inside reasoning tags, kept out of the reply. */
  reasoning?: string;
  error?: boolean;
  /** Tokens per second for the completed turn. */
  tps?: number;
  /**
   * Set when generation stopped because it hit the reply-length limit or
   * ran out of context, rather than because the model actually finished.
   * The content is real, just cut off mid-thought.
   */
  truncated?: boolean;
};

export type LoadState =
  | { status: 'idle' }
  | { status: 'loading'; modelId: string; progress: number; stage: string }
  | { status: 'ready'; modelId: string; vision: boolean }
  | { status: 'error'; modelId: string; message: string };

export type Settings = {
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  threads: number;
  contextSize: number;
  /** Cap on image detail. Lower is cooler and faster. */
  imageMaxTokens: number;
  immersive: boolean;
  keepScreenOn: boolean;
  showReasoning: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  systemPrompt:
    'You are a capable assistant running entirely on this device. Answer directly and completely. When the user attaches an image or a document, examine it carefully and ground your answer in what is actually there.',
  temperature: 0.7,
  topP: 0.9,
  // 1024 sounds generous until you ask for a full C++ or Python file —
  // that's routinely 1500-3000+ tokens, so the old default cut real
  // answers off mid-function. 2048 is a better balance of "long code still
  // fits" against "reply time on a phone stays reasonable"; the stepper in
  // Settings still lets it go higher for anyone who wants that trade-off.
  maxTokens: 2048,
  threads: 4,
  contextSize: 8192,
  imageMaxTokens: 512,
  immersive: false,
  keepScreenOn: true,
  showReasoning: false,
};

const SETTINGS_PATH = `${RNFS.DocumentDirectoryPath}/settings.json`;
const CHAT_PATH = `${RNFS.DocumentDirectoryPath}/conversation.json`;
const LAST_MODEL_PATH = `${RNFS.DocumentDirectoryPath}/last_model.json`;
const ARCHIVE_DIR = `${RNFS.DocumentDirectoryPath}/conversations`;

/** How long the vision projector gets to initialize before we give up on
 * it rather than let a hang leave the whole app stuck on the loading
 * screen (which is what "the composer never opens for image models" turns
 * out to be — vision init that never resolves). */
const MULTIMODAL_INIT_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      v => {
        clearTimeout(timer);
        resolve(v);
      },
      e => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

type LlamaContextValue = {
  loadState: LoadState;
  activeModel: InstalledModel | undefined;
  installed: InstalledModel[];
  refreshInstalled: () => Promise<void>;
  visionEnabled: boolean;
  isGenerating: boolean;
  messages: ChatMessage[];
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  loadModel: (installed: InstalledModel) => Promise<void>;
  unloadModel: () => Promise<void>;
  sendMessage: (text: string, attachments?: Attachment[]) => Promise<void>;
  regenerate: () => Promise<void>;
  continueReply: (messageId: string) => Promise<void>;
  stopGenerating: () => void;
  resetChat: () => void;
};

const Ctx = createContext<LlamaContextValue | null>(null);

let idCounter = 0;
const nextId = () => `msg_${++idCounter}_${Date.now()}`;

/**
 * Reasoning models emit their scratchpad inside tags. Showing that raw in
 * the bubble is noisy and confusing, so it gets split off and surfaced
 * separately (or hidden entirely, per settings).
 */
const REASONING_TAGS = ['think', 'thinking', 'reasoning', 'thought'];

function splitReasoning(raw: string): { visible: string; reasoning: string } {
  let visible = raw;
  let reasoning = '';
  for (const tag of REASONING_TAGS) {
    const closed = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gi');
    visible = visible.replace(closed, (_m, inner) => {
      reasoning += inner;
      return '';
    });
    // An unterminated opening tag means the model is still mid-thought.
    const open = new RegExp(`<${tag}>([\\s\\S]*)$`, 'i');
    const match = visible.match(open);
    if (match) {
      reasoning += match[1];
      visible = visible.replace(open, '');
    }
  }
  return { visible: visible.trimStart(), reasoning: reasoning.trim() };
}

export function LlamaProvider({ children }: { children: React.ReactNode }) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [installed, setInstalled] = useState<InstalledModel[]>([]);
  const [activeModel, setActiveModel] = useState<InstalledModel | undefined>();
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const contextRef = useRef<LlamaCppContext | null>(null);
  const stopRequested = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const pendingAutoLoad = useRef<InstalledModel | null>(null);

  // ---- persistence -------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        if (await RNFS.exists(SETTINGS_PATH)) {
          const saved = JSON.parse(await RNFS.readFile(SETTINGS_PATH, 'utf8'));
          setSettings({ ...DEFAULT_SETTINGS, ...saved });
        }
      } catch {
        // Corrupt settings shouldn't stop the app from opening.
      }
      try {
        if (await RNFS.exists(CHAT_PATH)) {
          const saved = JSON.parse(await RNFS.readFile(CHAT_PATH, 'utf8'));
          if (Array.isArray(saved)) setMessages(saved);
        }
      } catch {
        // Same.
      }
      const registry = await readRegistry();
      setInstalled(registry);

      // Restore whichever model was active last time, so closing and
      // reopening the app (or the OS reclaiming the Activity) doesn't mean
      // reselecting it by hand every single time.
      try {
        if (await RNFS.exists(LAST_MODEL_PATH)) {
          const { modelId } = JSON.parse(
            await RNFS.readFile(LAST_MODEL_PATH, 'utf8'),
          );
          const match = registry.find(m => m.id === modelId);
          if (match) {
            logEvent('auto_restore_model', { modelId });
            // loadModelRef is assigned further down, once defined.
            pendingAutoLoad.current = match;
          }
        }
      } catch {
        // No last-model record — fine, nothing to restore.
      }
    })();
  }, []);

  useEffect(() => {
    RNFS.writeFile(SETTINGS_PATH, JSON.stringify(settings), 'utf8').catch(() => {});
    DocKit.setImmersive(settings.immersive);
  }, [settings]);

  useEffect(() => {
    const t = setTimeout(() => {
      RNFS.writeFile(CHAT_PATH, JSON.stringify(messages.slice(-80)), 'utf8').catch(
        () => {},
      );
    }, 600);
    return () => clearTimeout(t);
  }, [messages]);

  // Keeping the screen awake only while a reply is streaming, rather than
  // for the whole session — a long generation shouldn't be interrupted,
  // but neither should the phone sit lit up doing nothing.
  useEffect(() => {
    DocKit.setKeepScreenOn(settings.keepScreenOn && isGenerating);
    return () => DocKit.setKeepScreenOn(false);
  }, [isGenerating, settings.keepScreenOn]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  const refreshInstalled = useCallback(async () => {
    setInstalled(await readRegistry());
  }, []);

  // ---- model lifecycle ---------------------------------------------

  const releaseContext = useCallback(async () => {
    if (contextRef.current) {
      try {
        await contextRef.current.release();
      } catch {
        // Already gone.
      }
      contextRef.current = null;
    }
    setVisionEnabled(false);
  }, []);

  const unloadModel = useCallback(async () => {
    await releaseContext();
    setActiveModel(undefined);
    setLoadState({ status: 'idle' });
    // An explicit unload is a decision, not a crash — don't reload this
    // model automatically next launch.
    RNFS.unlink(LAST_MODEL_PATH).catch(() => {});
    logEvent('model_unloaded');
  }, [releaseContext]);

  const loadModel = useCallback(
    async (model: InstalledModel) => {
      // Only one model fits in phone memory, so the previous one always
      // goes first. Note this runs even if the last load errored — an
      // earlier failure must never leave the engine permanently parked.
      await releaseContext();

      setActiveModel(model);
      setLoadState({
        status: 'loading',
        modelId: model.id,
        progress: 0,
        stage: 'Reading weights',
      });
      logEvent('model_load_start', { modelId: model.id, sizeBytes: model.sizeBytes });

      try {
        if (!(await RNFS.exists(model.path))) {
          throw new Error(
            'The model file is no longer at its saved location. Re-import it from the Models tab.',
          );
        }

        // A model that plainly won't fit in what's actually free right now
        // is the single biggest cause of a silent OS-level kill ("the app
        // just crashes"). Checking live available RAM — not just the
        // device's total — catches that before it happens, rather than
        // after.
        const device = await DocKit.getDeviceInfo();
        if (device && device.availRamBytes > 0) {
          const neededBytes = model.sizeBytes * 1.25 + 350 * 1024 * 1024;
          if (neededBytes > device.availRamBytes) {
            throw new Error(
              `Not enough free memory right now: this model needs roughly ${(
                neededBytes /
                1024 ** 3
              ).toFixed(1)} GB but only ${(device.availRamBytes / 1024 ** 3).toFixed(
                1,
              )} GB is free. Close other apps, pick a smaller model, or lower the context window in Settings.`,
            );
          }
        }

        const ctx = await initLlama(
          {
            model: model.path,
            n_ctx: settings.contextSize || model.contextSize,
            n_threads: settings.threads,
            n_gpu_layers: 0, // CPU only: GPU offload on Adreno is still a reliable way to overheat
            use_mlock: false,
            use_mmap: true,
          },
          progress => {
            setLoadState({
              status: 'loading',
              modelId: model.id,
              progress,
              stage: 'Reading weights',
            });
          },
        );
        contextRef.current = ctx;

        let vision = false;
        if (model.mmprojPath && (await RNFS.exists(model.mmprojPath))) {
          setLoadState({
            status: 'loading',
            modelId: model.id,
            progress: 99,
            stage: 'Starting vision encoder',
          });
          try {
            // Wrapped in a timeout: a projector that hangs (rather than
            // errors) used to leave the whole app parked on the loading
            // screen forever — which looked, from the chat tab, exactly
            // like "the composer never opens" for vision models.
            await withTimeout(
              ctx.initMultimodal({
                path: model.mmprojPath,
                use_gpu: false,
                image_max_tokens: settings.imageMaxTokens,
              }),
              MULTIMODAL_INIT_TIMEOUT_MS,
              'Vision encoder init',
            );
            const support = await ctx.getMultimodalSupport();
            vision = !!support?.vision;
          } catch (mmErr: any) {
            // A bad or slow projector shouldn't cost you the text model too.
            vision = false;
            logEvent('multimodal_init_failed', {
              modelId: model.id,
              message: mmErr?.message,
            });
          }
        }

        setVisionEnabled(vision);
        setLoadState({ status: 'ready', modelId: model.id, vision });
        logEvent('model_load_ready', { modelId: model.id, vision });

        RNFS.writeFile(
          LAST_MODEL_PATH,
          JSON.stringify({ modelId: model.id }),
          'utf8',
        ).catch(() => {});
      } catch (err: any) {
        await releaseContext();
        setLoadState({
          status: 'error',
          modelId: model.id,
          message: err?.message ?? 'Failed to load this model.',
        });
        logEvent('model_load_failed', { modelId: model.id, message: err?.message });
      }
    },
    [releaseContext, settings.contextSize, settings.threads, settings.imageMaxTokens],
  );

  // Fires once the registry has loaded and a previously-active model was
  // found (see the persistence effect above). Deferred to its own effect
  // so it always runs against the latest `loadModel` closure.
  useEffect(() => {
    if (pendingAutoLoad.current) {
      const model = pendingAutoLoad.current;
      pendingAutoLoad.current = null;
      loadModel(model);
    }
  }, [installed, loadModel]);

  // ---- generation ---------------------------------------------------

  const stopGenerating = useCallback(() => {
    stopRequested.current = true;
    contextRef.current?.stopCompletion().catch(() => {});
  }, []);

  const runCompletion = useCallback(
    async (history: ChatMessage[], assistantId: string) => {
      const ctx = contextRef.current;
      if (!ctx) return;

      setIsGenerating(true);
      stopRequested.current = false;
      const startedAt = Date.now();

      try {
        const apiMessages: any[] = [
          { role: 'system', content: settings.systemPrompt },
        ];

        for (const m of history) {
          if (m.role === 'assistant') {
            apiMessages.push({ role: 'assistant', content: m.content });
            continue;
          }
          const { imagePaths, textBlocks } = planAttachments(
            m.attachments ?? [],
            visionEnabled,
          );
          if (imagePaths.length === 0 && textBlocks.length === 0) {
            apiMessages.push({ role: m.role, content: m.content });
            continue;
          }
          const parts: any[] = imagePaths.map(p => ({
            type: 'image_url',
            image_url: { url: `file://${p}` },
          }));
          const textBody = [
            ...textBlocks,
            m.content.trim() || 'Analyse the attached material.',
          ].join('\n\n');
          parts.push({ type: 'text', text: textBody });
          apiMessages.push({ role: m.role, content: parts });
        }

        let accumulated = '';
        let tokenCount = 0;

        const result = await ctx.completion(
          {
            messages: apiMessages,
            n_predict: settings.maxTokens,
            temperature: settings.temperature,
            top_p: settings.topP,
          },
          data => {
            if (stopRequested.current) return;
            accumulated += data.token;
            tokenCount++;
            const { visible, reasoning } = splitReasoning(accumulated);
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId ? { ...m, content: visible, reasoning } : m,
              ),
            );
          },
        );

        const seconds = (Date.now() - startedAt) / 1000;
        const tps = seconds > 0 ? tokenCount / seconds : undefined;
        // The reply is genuinely cut off (not just done) when it stopped
        // because it ran into the length cap or the context window, rather
        // than because the model reached a natural end. Surfacing that
        // beats a big C++ file that just silently stops mid-function.
        const truncated =
          !stopRequested.current &&
          !result?.interrupted &&
          !result?.stopped_eos &&
          !result?.stopped_word &&
          (!!result?.stopped_limit || !!result?.context_full);
        setMessages(prev =>
          prev.map(m => (m.id === assistantId ? { ...m, tps, truncated } : m)),
        );
        if (truncated) {
          logEvent('reply_truncated', {
            maxTokens: settings.maxTokens,
            contextFull: !!result?.context_full,
          });
        }
      } catch (err: any) {
        logEvent('generation_error', { message: err?.message });
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  error: !m.content,
                  content:
                    m.content ||
                    `Generation failed: ${err?.message ?? 'unknown error'}`,
                }
              : m,
          ),
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [settings, visionEnabled],
  );

  const sendMessage = useCallback(
    async (text: string, attachments: Attachment[] = []) => {
      if (loadState.status !== 'ready' || !contextRef.current) return;
      const trimmed = text.trim();
      if (!trimmed && attachments.length === 0) return;

      const { skipped } = planAttachments(attachments, visionEnabled);

      const userMsg: ChatMessage = {
        id: nextId(),
        role: 'user',
        content: trimmed,
        attachments: attachments.length ? attachments : undefined,
      };
      const assistantId = nextId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
      };

      const history = [...messagesRef.current, userMsg];
      setMessages([...history, assistantMsg]);

      if (skipped.length) {
        // Say so rather than quietly ignoring an attachment.
        setMessages(prev => [
          ...prev.slice(0, -1),
          {
            id: nextId(),
            role: 'assistant',
            content: `Couldn't include:\n${skipped.map(s => `• ${s}`).join('\n')}`,
            error: true,
          },
          prev[prev.length - 1],
        ]);
      }

      await runCompletion(history, assistantId);
    },
    [loadState, runCompletion, visionEnabled],
  );

  const regenerate = useCallback(async () => {
    if (loadState.status !== 'ready' || isGenerating) return;
    const msgs = messagesRef.current;
    let lastUser = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        lastUser = i;
        break;
      }
    }
    if (lastUser < 0) return;

    const history = msgs.slice(0, lastUser + 1);
    const assistantId = nextId();
    setMessages([...history, { id: assistantId, role: 'assistant', content: '' }]);
    await runCompletion(history, assistantId);
  }, [loadState, isGenerating, runCompletion]);

  const continueReply = useCallback(
    async (messageId: string) => {
      if (loadState.status !== 'ready' || isGenerating) return;
      const msgs = messagesRef.current;
      const idx = msgs.findIndex(m => m.id === messageId);
      if (idx < 0) return;

      // Continuing is its own turn: the truncated reply stays in the
      // transcript as-is, and a fresh assistant message picks up after it,
      // told explicitly to carry straight on rather than restart.
      const history = [
        ...msgs.slice(0, idx + 1),
        {
          id: nextId(),
          role: 'user' as const,
          content:
            'Continue your previous reply exactly from where it stopped. Do not repeat anything you already said and do not restart from the beginning.',
        },
      ];
      const assistantId = nextId();
      setMessages([...history, { id: assistantId, role: 'assistant', content: '' }]);
      await runCompletion(history, assistantId);
    },
    [loadState, isGenerating, runCompletion],
  );

  const resetChat = useCallback(() => {
    const outgoing = messagesRef.current;
    setMessages([]);

    // Overwrite immediately rather than waiting for the debounced autosave
    // — otherwise a crash in the next second or two brings the "cleared"
    // conversation right back on relaunch.
    RNFS.writeFile(CHAT_PATH, JSON.stringify([]), 'utf8').catch(() => {});

    // Archive what was there rather than just discarding it, so "start a
    // new chat" doesn't mean the previous conversation is gone for good.
    if (outgoing.length > 0) {
      RNFS.mkdir(ARCHIVE_DIR)
        .catch(() => {})
        .finally(() => {
          RNFS.writeFile(
            `${ARCHIVE_DIR}/session-${Date.now()}.json`,
            JSON.stringify(outgoing),
            'utf8',
          ).catch(() => {});
        });
    }

    // Actually clear the model's own KV cache — a `?.()` that silently
    // swallows its result meant a failed clear left old turns bleeding
    // into the "new" conversation with no sign anything had gone wrong.
    contextRef.current
      ?.clearCache?.(true)
      ?.then(() => logEvent('chat_reset'))
      ?.catch((err: any) =>
        logEvent('chat_reset_cache_clear_failed', { message: err?.message }),
      );
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    logEvent('settings_reset');
  }, []);

  const value = useMemo<LlamaContextValue>(
    () => ({
      loadState,
      activeModel,
      installed,
      refreshInstalled,
      visionEnabled,
      isGenerating,
      messages,
      settings,
      updateSettings,
      resetSettings,
      loadModel,
      unloadModel,
      sendMessage,
      regenerate,
      continueReply,
      stopGenerating,
      resetChat,
    }),
    [
      loadState,
      activeModel,
      installed,
      refreshInstalled,
      visionEnabled,
      isGenerating,
      messages,
      settings,
      updateSettings,
      resetSettings,
      loadModel,
      unloadModel,
      sendMessage,
      regenerate,
      continueReply,
      stopGenerating,
      resetChat,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLlama(): LlamaContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLlama must be used within a LlamaProvider');
  return ctx;
}
