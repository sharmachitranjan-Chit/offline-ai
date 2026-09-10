import * as RNFS from '@dr.pogodin/react-native-fs';
import { Attachment } from './attachments';

/**
 * Conversation history.
 *
 * The app used to hold exactly one conversation, which meant every new
 * question destroyed the last one. Chats are now a list: start a new one,
 * come back to an old one, rename it, delete it.
 *
 * Everything is in a single JSON file. A phone will realistically hold a few
 * hundred conversations of a few hundred messages, which is a file measured
 * in low megabytes — not worth a database, and one atomic write is easier to
 * keep consistent than a directory of files that can half-exist.
 */

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
  createdAt?: number;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Which model produced it, for the subtitle in the drawer. */
  modelLabel?: string;
  messages: ChatMessage[];
};

const CHATS_PATH = `${RNFS.DocumentDirectoryPath}/chats.json`;
/** Where the single conversation lived before there were many. */
const LEGACY_CHAT_PATH = `${RNFS.DocumentDirectoryPath}/conversation.json`;

const MAX_CONVERSATIONS = 200;
const MAX_MESSAGES_PER_CONVERSATION = 400;

let counter = 0;
export const newId = (prefix = 'c') =>
  `${prefix}_${Date.now().toString(36)}_${(++counter).toString(36)}`;

export function emptyConversation(): Conversation {
  const now = Date.now();
  return {
    id: newId('chat'),
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

/** First line of the first thing the user said, which is what they'll recognise. */
export function deriveTitle(messages: ChatMessage[]): string | undefined {
  const first = messages.find(m => m.role === 'user');
  if (!first) return undefined;
  const source =
    first.content.trim() ||
    first.attachments?.map(a => a.name).join(', ') ||
    '';
  if (!source) return undefined;
  const line = source.split('\n')[0].trim();
  return line.length > 48 ? `${line.slice(0, 46)}…` : line;
}

export async function loadConversations(): Promise<Conversation[]> {
  try {
    if (await RNFS.exists(CHATS_PATH)) {
      const parsed = JSON.parse(await RNFS.readFile(CHATS_PATH, 'utf8'));
      if (Array.isArray(parsed?.conversations)) {
        return (parsed.conversations as Conversation[])
          .filter(c => c && Array.isArray(c.messages))
          .sort((a, b) => b.updatedAt - a.updatedAt);
      }
    }
    // One-time upgrade from the single-conversation format.
    if (await RNFS.exists(LEGACY_CHAT_PATH)) {
      const legacy = JSON.parse(await RNFS.readFile(LEGACY_CHAT_PATH, 'utf8'));
      if (Array.isArray(legacy) && legacy.length) {
        const conv: Conversation = {
          ...emptyConversation(),
          title: deriveTitle(legacy) ?? 'Earlier chat',
          messages: legacy,
        };
        await saveConversations([conv]);
        await RNFS.unlink(LEGACY_CHAT_PATH).catch(() => {});
        return [conv];
      }
    }
  } catch {
    // A corrupt history file should cost the history, not the app.
  }
  return [];
}

export async function saveConversations(list: Conversation[]): Promise<void> {
  const trimmed = list
    .slice(0, MAX_CONVERSATIONS)
    .map(c => ({
      ...c,
      messages: c.messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
    }));
  await RNFS.writeFile(
    CHATS_PATH,
    JSON.stringify({ version: 2, conversations: trimmed }),
    'utf8',
  ).catch(() => {});
}

/** Today / Yesterday / This week / Older — the grouping the drawer shows. */
export function groupConversations(
  list: Conversation[],
): Array<{ label: string; items: Conversation[] }> {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const day = 86_400_000;

  const buckets: Array<{ label: string; items: Conversation[] }> = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Previous 30 days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const conv of list) {
    const t = conv.updatedAt;
    if (t >= startOfToday) buckets[0].items.push(conv);
    else if (t >= startOfToday - day) buckets[1].items.push(conv);
    else if (t >= startOfToday - 7 * day) buckets[2].items.push(conv);
    else if (t >= startOfToday - 30 * day) buckets[3].items.push(conv);
    else buckets[4].items.push(conv);
  }
  return buckets.filter(b => b.items.length > 0);
}

export function searchConversations(
  list: Conversation[],
  query: string,
): Conversation[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    c =>
      c.title.toLowerCase().includes(q) ||
      c.messages.some(m => m.content.toLowerCase().includes(q)),
  );
}
