import {
  ChatMessage,
  Conversation,
  deriveTitle,
  emptyConversation,
  groupConversations,
  searchConversations,
} from '../src/services/conversations';

const msg = (role: ChatMessage['role'], content: string): ChatMessage => ({
  id: `${role}-${content}`,
  role,
  content,
});

const at = (title: string, updatedAt: number): Conversation => ({
  ...emptyConversation(),
  title,
  updatedAt,
});

describe('conversation titles', () => {
  it('uses the first line of the first thing the user said', () => {
    expect(
      deriveTitle([
        msg('assistant', 'ignored'),
        msg('user', 'How do I compute EMI?\nSecond line'),
      ]),
    ).toBe('How do I compute EMI?');
  });

  it('truncates a long opening message', () => {
    const title = deriveTitle([msg('user', 'x'.repeat(120))])!;
    expect(title.length).toBeLessThanOrEqual(48);
    expect(title.endsWith('…')).toBe(true);
  });

  it('falls back to attachment names when the message is only a file', () => {
    expect(
      deriveTitle([
        {
          id: '1',
          role: 'user',
          content: '   ',
          attachments: [
            {
              id: 'a',
              kind: 'pdf',
              name: 'statement.pdf',
              mime: 'application/pdf',
              size: 10,
            },
          ],
        },
      ]),
    ).toBe('statement.pdf');
  });

  it('has no title for an empty conversation', () => {
    expect(deriveTitle([])).toBeUndefined();
  });
});

describe('grouping', () => {
  it('buckets by age and drops empty buckets', () => {
    const day = 86_400_000;
    const groups = groupConversations([
      at('now', Date.now()),
      at('last week', Date.now() - 4 * day),
      at('ancient', Date.now() - 200 * day),
    ]);
    expect(groups.map(g => g.label)).toEqual([
      'Today',
      'Previous 7 days',
      'Older',
    ]);
  });
});

describe('search', () => {
  const list: Conversation[] = [
    { ...emptyConversation(), title: 'Home loan maths' },
    {
      ...emptyConversation(),
      title: 'Something else',
      messages: [msg('user', 'explain CIBIL scoring')],
    },
  ];

  it('matches titles and message bodies', () => {
    expect(searchConversations(list, 'loan')).toHaveLength(1);
    expect(searchConversations(list, 'cibil')).toHaveLength(1);
    expect(searchConversations(list, '')).toHaveLength(2);
    expect(searchConversations(list, 'nothing here')).toHaveLength(0);
  });
});
