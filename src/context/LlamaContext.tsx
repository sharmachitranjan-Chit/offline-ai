import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { initLlama, LlamaContext as LlamaCppContext } from 'llama.rn';
import { ModelEntry, getModelById } from '../data/modelCatalog';
import { localPathForModel } from '../services/modelManager';

export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type LoadState =
  | { status: 'idle' }
  | { status: 'loading'; modelId: string; progress: number }
  | { status: 'ready'; modelId: string }
  | { status: 'error'; modelId: string; message: string };

type LlamaContextValue = {
  loadState: LoadState;
  activeModel: ModelEntry | undefined;
  isGenerating: boolean;
  messages: ChatMessage[];
  loadModel: (modelId: string) => Promise<void>;
  unloadModel: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  stopGenerating: () => void;
  resetChat: () => void;
};

const SYSTEM_PROMPT =
  'You are a helpful assistant running entirely offline on the user\'s phone. ' +
  'Be concise and direct.';

const LlamaReactContext = createContext<LlamaContextValue | null>(null);

let idCounter = 0;
const nextId = () => `msg_${++idCounter}_${Date.now()}`;

export function LlamaProvider({ children }: { children: React.ReactNode }) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const contextRef = useRef<LlamaCppContext | null>(null);
  const stopRequested = useRef(false);

  const activeModel = useMemo(() => {
    if (loadState.status === 'ready' || loadState.status === 'loading') {
      return getModelById(loadState.modelId);
    }
    return undefined;
  }, [loadState]);

  const unloadModel = useCallback(async () => {
    if (contextRef.current) {
      try {
        await contextRef.current.release();
      } catch {
        // Context may already be gone; nothing to do.
      }
      contextRef.current = null;
    }
    setMessages([]);
    setLoadState({ status: 'idle' });
  }, []);

  const loadModel = useCallback(
    async (modelId: string) => {
      const model = getModelById(modelId);
      if (!model) return;

      // Release any previously loaded model first — only one fits in
      // memory at a time on a phone anyway.
      if (contextRef.current) {
        try {
          await contextRef.current.release();
        } catch {
          // ignore
        }
        contextRef.current = null;
      }

      setMessages([]);
      setLoadState({ status: 'loading', modelId, progress: 0 });

      try {
        const ctx = await initLlama(
          {
            model: localPathForModel(model),
            n_ctx: model.recommendedContext,
            n_threads: 4,
            use_mlock: false,
          },
          progress => {
            setLoadState({ status: 'loading', modelId, progress });
          },
        );
        contextRef.current = ctx;
        setLoadState({ status: 'ready', modelId });
      } catch (err: any) {
        setLoadState({
          status: 'error',
          modelId,
          message: err?.message ?? 'Failed to load model.',
        });
      }
    },
    [],
  );

  const stopGenerating = useCallback(() => {
    stopRequested.current = true;
    contextRef.current?.stopCompletion().catch(() => {});
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const ctx = contextRef.current;
      if (!ctx || loadState.status !== 'ready') return;

      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = {
        id: nextId(),
        role: 'user',
        content: trimmed,
      };
      const assistantId = nextId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
      };

      setMessages(prev => [...prev, userMsg, assistantMsg]);
      setIsGenerating(true);
      stopRequested.current = false;

      try {
        // `messages` here is the state as of the last render — i.e. the
        // conversation *before* this turn's user/assistant placeholder
        // were appended above, which is exactly the prior history we want.
        const history = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: trimmed },
        ];

        let accumulated = '';
        await ctx.completion(
          {
            messages: history as any,
            n_predict: 512,
            temperature: 0.7,
            top_p: 0.9,
          },
          data => {
            if (stopRequested.current) return;
            accumulated += data.token;
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId ? { ...m, content: accumulated } : m,
              ),
            );
          },
        );
      } catch (err: any) {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    m.content ||
                    `⚠️ Generation failed: ${err?.message ?? 'unknown error'}`,
                }
              : m,
          ),
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [loadState, messages],
  );

  const resetChat = useCallback(() => {
    setMessages([]);
  }, []);

  const value: LlamaContextValue = {
    loadState,
    activeModel,
    isGenerating,
    messages,
    loadModel,
    unloadModel,
    sendMessage,
    stopGenerating,
    resetChat,
  };

  return (
    <LlamaReactContext.Provider value={value}>
      {children}
    </LlamaReactContext.Provider>
  );
}

export function useLlama(): LlamaContextValue {
  const ctx = useContext(LlamaReactContext);
  if (!ctx) {
    throw new Error('useLlama must be used within a LlamaProvider');
  }
  return ctx;
}
