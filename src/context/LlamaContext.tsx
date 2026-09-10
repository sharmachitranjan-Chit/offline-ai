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
  maxTokens: 1024,
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
  loadModel: (installed: InstalledModel) => Promise<void>;
  unloadModel: () => Promise<void>;
  sendMessage: (text: string, attachments?: Attachment[]) => Promise<void>;
  /** Replaces a user turn and re-runs everything after it. */
  editMessage: (id: string, text: string) => Promise<void>;
  regenerate: () => Promise<void>;
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
      try {
        if (await RNFS.exists(SETTINGS_PATH)) {
          const saved = JSON.parse(await RNFS.readFile(SETTINGS_PATH, 'utf8'));
          loaded = { ...DEFAULT_SETTINGS, ...saved };
        }
      } catch {
        // Corrupt settings shouldn't stop the app from opening.
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

      if (loaded.autoLoadLastModel && loaded.lastModelId) {
        const last = models.find(m => m.id === loaded.lastModelId);
        if (last) loadModelRef.current?.(last);
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

  const newChat = useCallback(() => {
    // An untouched blank chat is reused rather than stacking up empties.
    const existingBlank = conversationsRef.current.find(c => c.messages.length === 0);
    if (existingBlank) {
      setActiveId(existingBlank.id);
      return;
    }
    const fresh = emptyConversation();
    setConversations(prev => [fresh, ...prev]);
    setActiveId(fresh.id);
  }, []);

  const selectChat = useCallback((id: string) => setActiveId(id), []);

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
            await ctx.initMultimodal({
              path: model.mmprojPath,
              use_gpu: false,
              image_max_tokens: s.imageMaxTokens,
            });
            const support = await ctx.getMultimodalSupport();
            vision = !!support?.vision;
          } catch {
            // A bad projector shouldn't cost you the text model too.
            vision = false;
          }
        }

        setVisionEnabled(vision);
        setLoadState({ status: 'ready', modelId: model.id, vision });
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
    async (conversationId: string, history: ChatMessage[], assistantId: string) => {
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

        let accumulated = '';
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
                      m.id === assistantId ? { ...m, content: visible, reasoning } : m,
                    ),
                  },
            ),
          );
        };

        await ctx.completion(
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
        setConversations(prev =>
          prev.map(c =>
            c.id !== conversationId
              ? c
              : {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map(m =>
                    m.id === assistantId ? { ...m, tps } : m,
                  ),
                },
          ),
        );
      } catch (err: any) {
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
      loadModel,
      unloadModel,
      sendMessage,
      editMessage,
      regenerate,
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
      loadModel,
      unloadModel,
      sendMessage,
      editMessage,
      regenerate,
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
