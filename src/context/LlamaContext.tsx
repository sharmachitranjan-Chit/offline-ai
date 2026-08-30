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
  maxTokens: 1024,
  threads: 4,
  contextSize: 8192,
  imageMaxTokens: 512,
  immersive: false,
  keepScreenOn: true,
  showReasoning: false,
};

const SETTINGS_PATH = `${RNFS.DocumentDirectoryPath}/settings.json`;
const CHAT_PATH = `${RNFS.DocumentDirectoryPath}/conversation.json`;

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
  loadModel: (installed: InstalledModel) => Promise<void>;
  unloadModel: () => Promise<void>;
  sendMessage: (text: string, attachments?: Attachment[]) => Promise<void>;
  regenerate: () => Promise<void>;
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
      setInstalled(await readRegistry());
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

      try {
        if (!(await RNFS.exists(model.path))) {
          throw new Error(
            'The model file is no longer at its saved location. Re-import it from the Models tab.',
          );
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
            await ctx.initMultimodal({
              path: model.mmprojPath,
              use_gpu: false,
              image_max_tokens: settings.imageMaxTokens,
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
      } catch (err: any) {
        await releaseContext();
        setLoadState({
          status: 'error',
          modelId: model.id,
          message: err?.message ?? 'Failed to load this model.',
        });
      }
    },
    [releaseContext, settings.contextSize, settings.threads, settings.imageMaxTokens],
  );

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

        await ctx.completion(
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
        setMessages(prev =>
          prev.map(m => (m.id === assistantId ? { ...m, tps } : m)),
        );
      } catch (err: any) {
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

  const resetChat = useCallback(() => {
    setMessages([]);
    contextRef.current?.clearCache?.(false).catch(() => {});
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
      loadModel,
      unloadModel,
      sendMessage,
      regenerate,
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
      loadModel,
      unloadModel,
      sendMessage,
      regenerate,
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
