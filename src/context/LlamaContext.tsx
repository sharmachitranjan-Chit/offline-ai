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
import {
  InstalledModel,
  readRegistry,
  syncWithFolder,
} from '../services/modelManager';
import { Attachment, planAttachments } from '../services/attachments';
import {
  ChatMessage,
  Conversation,
  deriveTitle,
  emptyConversation,
  loadConversations,
  newId,
  saveConversations,
} from '../services/conversations';
import { DocKit } from '../native/DocKit';
import { logEvent } from '../services/diagnostics';

export type { ChatMessage, ChatRole } from '../services/conversations';

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
  /** Load the model you used last as soon as the app opens. */
  autoLoadLastModel: boolean;
  /** Tokens per second under each reply. */
  showStats: boolean;
  /** Remembered between launches so auto-load knows what to open. */
  lastModelId?: string;
};

export const DEFAULT_SETTINGS: Settings = {
  systemPrompt:
    'You are a capable assistant running entirely on this device. Answer directly and completely. When the user attaches an image or a document, examine it carefully and ground your answer in what is actually there.',
  temperature: 0.7,
  topP: 0.9,
  // 1024 cuts a full code file off mid-function; 2048 fits long code while
  // keeping reply time on a phone reasonable.
  maxTokens: 2048,
  threads: 4,
  contextSize: 8192,
  imageMaxTokens: 512,
  immersive: false,
  keepScreenOn: true,
  showReasoning: false,
  autoLoadLastModel: true,
  showStats: true,
};

const SETTINGS_PATH = `${RNFS.DocumentDirectoryPath}/settings.json`;

/** How long the vision projector gets to initialise before it is abandoned,
 * so a hang (rather than an error) can't park the app on the loading screen. */
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

/**
 * Generation settings from what the phone actually reports. Context size
 * drives the KV cache (real, non-swappable RAM) and more threads stop helping
 * past the efficiency cores, so both scale with available memory and cores.
 */
export function recommendedSettings(device: {
  totalRamBytes: number;
  availRamBytes: number;
  cores: number;
}): Pick<Settings, 'contextSize' | 'maxTokens' | 'threads' | 'imageMaxTokens'> {
  const availGiB = device.availRamBytes / 1024 ** 3;
  const contextSize = availGiB < 2 ? 2048 : availGiB < 3.5 ? 4096 : availGiB < 6 ? 6144 : 8192;
  const maxTokens = availGiB < 2 ? 1024 : availGiB < 3.5 ? 1536 : 2048;
  const threads = Math.max(2, Math.min(6, Math.round(device.cores / 2)));
  const imageMaxTokens = availGiB < 3 ? 256 : 512;
  return { contextSize, maxTokens, threads, imageMaxTokens };
}

type LlamaContextValue = {
  loadState: LoadState;
  activeModel: InstalledModel | undefined;
  installed: InstalledModel[];
  refreshInstalled: () => Promise<InstalledModel[]>;
  visionEnabled: boolean;
  isGenerating: boolean;

  conversations: Conversation[];
  activeConversation: Conversation | undefined;
  messages: ChatMessage[];
  newChat: () => void;
  selectChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  deleteChat: (id: string) => void;
  deleteAllChats: () => void;

  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Everything back to defaults (keeps the remembered model). */
  resetSettings: () => void;
  /** Re-derives context/threads/reply length/image detail from this phone. */
  tuneForDevice: () => Promise<boolean>;
  loadModel: (installed: InstalledModel) => Promise<void>;
  unloadModel: () => Promise<void>;
  sendMessage: (text: string, attachments?: Attachment[]) => Promise<void>;
  /** Replaces a user turn and re-runs everything after it. */
  editMessage: (id: string, text: string) => Promise<void>;
  regenerate: () => Promise<void>;
  /** Picks a cut-off reply up where it stopped, in the same bubble. */
  continueReply: (messageId: string) => Promise<void>;
  stopGenerating: () => void;
};

const Ctx = createContext<LlamaContextValue | null>(null);

/** A stable empty array, so "no conversation" doesn't rerender everything. */
const EMPTY_MESSAGES: ChatMessage[] = [];

/**
 * Reasoning models emit their scratchpad inside tags. Showing that raw in the
 * bubble is noisy and confusing, so it gets split off and surfaced separately
 * (or hidden entirely, per settings).
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [installed, setInstalled] = useState<InstalledModel[]>([]);
  const [activeModel, setActiveModel] = useState<InstalledModel | undefined>();
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();

  const contextRef = useRef<LlamaCppContext | null>(null);
  const stopRequested = useRef(false);
  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;
  const activeIdRef = useRef<string | undefined>(undefined);
  activeIdRef.current = activeId;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const isGeneratingRef = useRef(false);
  isGeneratingRef.current = isGenerating;

  const activeConversation = useMemo(
    () => conversations.find(c => c.id === activeId),
    [conversations, activeId],
  );
  const messages = useMemo(
    () => activeConversation?.messages ?? EMPTY_MESSAGES,
    [activeConversation],
  );

  // ---- persistence -------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loaded = DEFAULT_SETTINGS;
      let hadSavedSettings = false;
      try {
        if (await RNFS.exists(SETTINGS_PATH)) {
          hadSavedSettings = true;
          const saved = JSON.parse(await RNFS.readFile(SETTINGS_PATH, 'utf8'));
          loaded = { ...DEFAULT_SETTINGS, ...saved };
        }
      } catch {
        // Corrupt settings shouldn't stop the app from opening.
      }
      if (cancelled) return;
      // First launch: start from what this phone actually has rather than
      // one fixed default that's wrong for both tight and roomy devices.
      if (!hadSavedSettings) {
        const device = await DocKit.getDeviceInfo();
        if (device) {
          const tuned = recommendedSettings(device);
          loaded = { ...loaded, ...tuned };
          logEvent('settings_auto_tuned_first_run', tuned);
        }
      }
      if (cancelled) return;
      setSettings(loaded);

      const chats = await loadConversations();
      if (cancelled) return;
      if (chats.length) {
        setConversations(chats);
        setActiveId(chats[0].id);
      } else {
        const fresh = emptyConversation();
        setConversations([fresh]);
        setActiveId(fresh.id);
      }

      // The models folder is the source of truth: anything dropped in by
      // another app, a browser or a file manager shows up without an import.
      const models = await syncWithFolder().catch(() => readRegistry());
      if (cancelled) return;
      setInstalled(models);

      // Builds before 2.1 kept the last model in its own file.
      if (!loaded.lastModelId) {
        try {
          const legacyPath = `${RNFS.DocumentDirectoryPath}/last_model.json`;
          if (await RNFS.exists(legacyPath)) {
            const { modelId } = JSON.parse(await RNFS.readFile(legacyPath, 'utf8'));
            if (typeof modelId === 'string') loaded = { ...loaded, lastModelId: modelId };
            RNFS.unlink(legacyPath).catch(() => {});
            if (!cancelled) setSettings(loaded);
          }
        } catch {
          // Nothing to carry over.
        }
      }

      if (loaded.autoLoadLastModel && loaded.lastModelId) {
        const last = models.find(m => m.id === loaded.lastModelId);
        if (last) {
          logEvent('auto_restore_model', { modelId: last.id });
          loadModelRef.current?.(last);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately runs once: this is app start-up.
  }, []);

  useEffect(() => {
    RNFS.writeFile(SETTINGS_PATH, JSON.stringify(settings), 'utf8').catch(() => {});
    DocKit.setImmersive(settings.immersive);
  }, [settings]);

  // Conversations are written on a short delay so a streaming reply doesn't
  // rewrite the whole history file on every token.
  useEffect(() => {
    if (!conversations.length) return;
    const t = setTimeout(() => saveConversations(conversations), 700);
    return () => clearTimeout(t);
  }, [conversations]);

  // Keeping the screen awake only while a reply is streaming, rather than for
  // the whole session — a long generation shouldn't be interrupted, but
  // neither should the phone sit lit up doing nothing.
  useEffect(() => {
    DocKit.setKeepScreenOn(settings.keepScreenOn && isGenerating);
    return () => DocKit.setKeepScreenOn(false);
  }, [isGenerating, settings.keepScreenOn]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(prev => ({ ...DEFAULT_SETTINGS, lastModelId: prev.lastModelId }));
    logEvent('settings_reset');
  }, []);

  const tuneForDevice = useCallback(async () => {
    const device = await DocKit.getDeviceInfo();
    if (!device) return false;
    const tuned = recommendedSettings(device);
    setSettings(prev => ({ ...prev, ...tuned }));
    logEvent('settings_tuned', tuned);
    return true;
  }, []);

  const refreshInstalled = useCallback(async () => {
    const models = await syncWithFolder().catch(() => readRegistry());
    setInstalled(models);
    return models;
  }, []);

  // ---- conversation plumbing ---------------------------------------

  const patchConversation = useCallback(
    (id: string, patch: (c: Conversation) => Conversation) => {
      setConversations(prev =>
        prev.map(c => (c.id === id ? patch(c) : c)),
      );
    },
    [],
  );

  /** Drops the previous chat's tokens from the KV cache so a different
   * conversation starts clean. Never while a reply is streaming. */
  const clearKvCache = useCallback(() => {
    if (isGeneratingRef.current) return;
    contextRef.current?.clearCache?.(false)?.catch?.(() => {});
  }, []);

  const newChat = useCallback(() => {
    // An untouched blank chat is reused rather than stacking up empties.
    const existingBlank = conversationsRef.current.find(c => c.messages.length === 0);
    clearKvCache();
    if (existingBlank) {
      setActiveId(existingBlank.id);
      return;
    }
    const fresh = emptyConversation();
    setConversations(prev => [fresh, ...prev]);
    setActiveId(fresh.id);
  }, [clearKvCache]);

  const selectChat = useCallback(
    (id: string) => {
      if (id !== activeIdRef.current) clearKvCache();
      setActiveId(id);
    },
    [clearKvCache],
  );

  const renameChat = useCallback(
    (id: string, title: string) => {
      const clean = title.trim();
      if (!clean) return;
      patchConversation(id, c => ({ ...c, title: clean }));
    },
    [patchConversation],
  );

  const deleteChat = useCallback((id: string) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === 0) {
        const fresh = emptyConversation();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (activeIdRef.current === id) setActiveId(next[0].id);
      return next;
    });
  }, []);

  const deleteAllChats = useCallback(() => {
    const fresh = emptyConversation();
    setConversations([fresh]);
    setActiveId(fresh.id);
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
    // An explicit unload is a decision, not a crash — don't reopen this
    // model automatically on the next launch.
    setSettings(prev => (prev.lastModelId ? { ...prev, lastModelId: undefined } : prev));
    logEvent('model_unloaded');
  }, [releaseContext]);

  const loadModel = useCallback(
    async (model: InstalledModel) => {
      // Only one model fits in phone memory, so the previous one always goes
      // first. This runs even if the last load errored — an earlier failure
      // must never leave the engine permanently parked.
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
            'The model file is no longer at its saved location. It may have been moved or deleted from the models folder.',
          );
        }

        const s = settingsRef.current;
        const ctx = await initLlama(
          {
            model: model.path,
            n_ctx: s.contextSize || model.contextSize,
            n_threads: s.threads,
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
            // A projector that hangs (rather than errors) used to leave the
            // app on the loading screen forever, so it gets a deadline.
            await withTimeout(
              ctx.initMultimodal({
                path: model.mmprojPath,
                use_gpu: false,
                image_max_tokens: s.imageMaxTokens,
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
        setSettings(prev =>
          prev.lastModelId === model.id ? prev : { ...prev, lastModelId: model.id },
        );
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
    [releaseContext],
  );

  // Start-up auto-load happens before `loadModel` is in scope, so it goes
  // through a ref rather than being wired as an effect dependency.
  const loadModelRef = useRef(loadModel);
  loadModelRef.current = loadModel;

  // ---- generation ---------------------------------------------------

  const stopGenerating = useCallback(() => {
    stopRequested.current = true;
    contextRef.current?.stopCompletion().catch(() => {});
  }, []);

  const runCompletion = useCallback(
    async (
      conversationId: string,
      history: ChatMessage[],
      assistantId: string,
      opts: { extraInstruction?: string; seed?: string } = {},
    ) => {
      const ctx = contextRef.current;
      if (!ctx) return;

      setIsGenerating(true);
      stopRequested.current = false;
      const startedAt = Date.now();
      const s = settingsRef.current;

      try {
        const apiMessages: any[] = [{ role: 'system', content: s.systemPrompt }];

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

        if (opts.extraInstruction) {
          apiMessages.push({ role: 'user', content: opts.extraInstruction });
        }

        let accumulated = opts.seed ?? '';
        let tokenCount = 0;
        let lastPaint = 0;

        const paint = (force = false) => {
          const now = Date.now();
          // Repainting on every token means a state update and a re-render
          // per token; at 20 tok/s that is wasted work the phone pays for in
          // heat. Painting on a ~16 fps cadence looks identical.
          if (!force && now - lastPaint < 60) return;
          lastPaint = now;
          const { visible, reasoning } = splitReasoning(accumulated);
          setConversations(prev =>
            prev.map(c =>
              c.id !== conversationId
                ? c
                : {
                    ...c,
                    messages: c.messages.map(m =>
                      m.id === assistantId
                        ? {
                            ...m,
                            content: visible,
                            // A continuation emits no new reasoning; keep the original.
                            reasoning: reasoning || m.reasoning,
                            truncated: false,
                          }
                        : m,
                    ),
                  },
            ),
          );
        };

        const result: any = await ctx.completion(
          {
            messages: apiMessages,
            n_predict: s.maxTokens,
            temperature: s.temperature,
            top_p: s.topP,
          },
          data => {
            if (stopRequested.current) return;
            accumulated += data.token;
            tokenCount++;
            paint();
          },
        );

        const seconds = (Date.now() - startedAt) / 1000;
        const tps = seconds > 0 ? tokenCount / seconds : undefined;
        paint(true);
        // Cut off (not finished) when it hit the length cap or the context
        // window rather than a natural end — surfaced so a long code file
        // doesn't just silently stop mid-function.
        const truncated =
          !stopRequested.current &&
          !result?.interrupted &&
          !result?.stopped_eos &&
          !result?.stopped_word &&
          (!!result?.stopped_limit || !!result?.context_full);
        setConversations(prev =>
          prev.map(c =>
            c.id !== conversationId
              ? c
              : {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map(m =>
                    m.id === assistantId ? { ...m, tps, truncated } : m,
                  ),
                },
          ),
        );
        if (truncated) {
          logEvent('reply_truncated', {
            maxTokens: s.maxTokens,
            contextFull: !!result?.context_full,
          });
        }
      } catch (err: any) {
        logEvent('generation_error', { message: err?.message });
        setConversations(prev =>
          prev.map(c =>
            c.id !== conversationId
              ? c
              : {
                  ...c,
                  messages: c.messages.map(m =>
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
                },
          ),
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [visionEnabled],
  );

  const startTurn = useCallback(
    async (conversationId: string, history: ChatMessage[], notices: string[]) => {
      const assistantId = newId('msg');
      const extra: ChatMessage[] = notices.map(text => ({
        id: newId('msg'),
        role: 'assistant',
        content: text,
        error: true,
        createdAt: Date.now(),
      }));

      setConversations(prev =>
        prev.map(c =>
          c.id !== conversationId
            ? c
            : {
                ...c,
                title:
                  c.title === 'New chat'
                    ? deriveTitle(history) ?? c.title
                    : c.title,
                modelLabel: activeModel?.label ?? c.modelLabel,
                updatedAt: Date.now(),
                messages: [
                  ...history,
                  ...extra,
                  {
                    id: assistantId,
                    role: 'assistant',
                    content: '',
                    createdAt: Date.now(),
                  },
                ],
              },
        ),
      );

      await runCompletion(conversationId, history, assistantId);
    },
    [runCompletion, activeModel],
  );

  const sendMessage = useCallback(
    async (text: string, attachments: Attachment[] = []) => {
      const conversationId = activeIdRef.current;
      if (!conversationId) return;
      if (loadState.status !== 'ready' || !contextRef.current) return;
      const trimmed = text.trim();
      if (!trimmed && attachments.length === 0) return;

      const { skipped } = planAttachments(attachments, visionEnabled);
      const current =
        conversationsRef.current.find(c => c.id === conversationId)?.messages ?? [];

      const userMsg: ChatMessage = {
        id: newId('msg'),
        role: 'user',
        content: trimmed,
        attachments: attachments.length ? attachments : undefined,
        createdAt: Date.now(),
      };

      await startTurn(
        conversationId,
        [...current, userMsg],
        // Say so rather than quietly ignoring an attachment.
        skipped.length
          ? [`Couldn't include:\n${skipped.map(s => `• ${s}`).join('\n')}`]
          : [],
      );
    },
    [loadState, visionEnabled, startTurn],
  );

  const editMessage = useCallback(
    async (id: string, text: string) => {
      const conversationId = activeIdRef.current;
      if (!conversationId || loadState.status !== 'ready' || isGenerating) return;
      const conv = conversationsRef.current.find(c => c.id === conversationId);
      if (!conv) return;
      const index = conv.messages.findIndex(m => m.id === id);
      if (index < 0) return;

      const history = [
        ...conv.messages.slice(0, index),
        { ...conv.messages[index], content: text.trim(), tps: undefined },
      ];
      await startTurn(conversationId, history, []);
    },
    [loadState, isGenerating, startTurn],
  );

  const regenerate = useCallback(async () => {
    const conversationId = activeIdRef.current;
    if (!conversationId || loadState.status !== 'ready' || isGenerating) return;
    const conv = conversationsRef.current.find(c => c.id === conversationId);
    if (!conv) return;

    let lastUser = -1;
    for (let i = conv.messages.length - 1; i >= 0; i--) {
      if (conv.messages[i].role === 'user') {
        lastUser = i;
        break;
      }
    }
    if (lastUser < 0) return;
    await startTurn(conversationId, conv.messages.slice(0, lastUser + 1), []);
  }, [loadState, isGenerating, startTurn]);

  const continueReply = useCallback(
    async (messageId: string) => {
      const conversationId = activeIdRef.current;
      if (!conversationId || loadState.status !== 'ready' || isGenerating) return;
      const conv = conversationsRef.current.find(c => c.id === conversationId);
      if (!conv) return;
      const idx = conv.messages.findIndex(m => m.id === messageId);
      if (idx < 0 || conv.messages[idx].role !== 'assistant') return;
      const target = conv.messages[idx];
      // The cut-off turn goes back as context, a hidden instruction asks for
      // the rest, and new tokens append onto the same bubble — one reply,
      // not fragments across several turns.
      await runCompletion(conversationId, conv.messages.slice(0, idx + 1), messageId, {
        extraInstruction:
          'Continue your previous reply exactly from where it stopped. Do not repeat anything you already said and do not restart from the beginning.',
        seed: target.content,
      });
    },
    [loadState, isGenerating, runCompletion],
  );

  const value = useMemo<LlamaContextValue>(
    () => ({
      loadState,
      activeModel,
      installed,
      refreshInstalled,
      visionEnabled,
      isGenerating,
      conversations,
      activeConversation,
      messages,
      newChat,
      selectChat,
      renameChat,
      deleteChat,
      deleteAllChats,
      settings,
      updateSettings,
      resetSettings,
      tuneForDevice,
      loadModel,
      unloadModel,
      sendMessage,
      editMessage,
      regenerate,
      continueReply,
      stopGenerating,
    }),
    [
      loadState,
      activeModel,
      installed,
      refreshInstalled,
      visionEnabled,
      isGenerating,
      conversations,
      activeConversation,
      messages,
      newChat,
      selectChat,
      renameChat,
      deleteChat,
      deleteAllChats,
      settings,
      updateSettings,
      resetSettings,
      tuneForDevice,
      loadModel,
      unloadModel,
      sendMessage,
      editMessage,
      regenerate,
      continueReply,
      stopGenerating,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLlama(): LlamaContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLlama must be used within a LlamaProvider');
  return ctx;
}
