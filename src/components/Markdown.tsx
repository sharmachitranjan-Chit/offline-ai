import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DocKit } from '../native/DocKit';
import { colors, fontSizes, radius, spacing } from '../theme';

/**
 * A deliberately small markdown renderer.
 *
 * Pulling in a full markdown library for this would add a dependency, a
 * bundle-size hit and an upgrade liability, to render the handful of
 * constructs a chat model actually produces: fenced code, headings, lists,
 * bold, italic and inline code. So it's hand-rolled.
 */

type Block =
  | { type: 'code'; lang: string; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'rule' }
  | { type: 'para'; text: string };

function parse(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence (or end of input, if the stream was cut short)
      blocks.push({ type: 'code', lang, text: body.join('\n') });
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s-*_]*$/.test(line)) {
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        text: heading[2],
      });
      i++;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'quote', text: body.join(' ') });
      continue;
    }

    const bullet = /^\s*([-*+])\s+(.*)$/;
    const numbered = /^\s*\d+[.)]\s+(.*)$/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(ordered ? numbered : bullet);
        if (!m) break;
        items.push(ordered ? m[1] : m[2]);
        i++;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trimStart().startsWith('```') &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !bullet.test(lines[i]) &&
      !numbered.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'para', text: para.join('\n') });
  }

  return blocks;
}

/** Renders bold / italic / inline-code / strikethrough inside a line. */
function Inline({ text, style }: { text: string; style?: any }) {
  const parts = useMemo(() => {
    const out: Array<{ t: string; kind: string }> = [];
    const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(~~[^~]+~~)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ t: text.slice(last, m.index), kind: 'plain' });
      const tok = m[0];
      if (tok.startsWith('`')) out.push({ t: tok.slice(1, -1), kind: 'code' });
      else if (tok.startsWith('**') || tok.startsWith('__'))
        out.push({ t: tok.slice(2, -2), kind: 'bold' });
      else if (tok.startsWith('~~')) out.push({ t: tok.slice(2, -2), kind: 'strike' });
      else out.push({ t: tok.slice(1, -1), kind: 'italic' });
      last = m.index + tok.length;
    }
    if (last < text.length) out.push({ t: text.slice(last), kind: 'plain' });
    return out;
  }, [text]);

  return (
    <Text style={style}>
      {parts.map((p, idx) => (
        <Text
          key={idx}
          style={
            p.kind === 'bold'
              ? styles.bold
              : p.kind === 'italic'
              ? styles.italic
              : p.kind === 'strike'
              ? styles.strike
              : p.kind === 'code'
              ? styles.inlineCode
              : undefined
          }>
          {p.t}
        </Text>
      ))}
    </Text>
  );
}

function CodeBlock({ lang, text }: { lang: string; text: string }) {
  return (
    <View style={styles.codeWrap}>
      <View style={styles.codeHeader}>
        <Text style={styles.codeLang}>{lang || 'code'}</Text>
        <Pressable
          hitSlop={10}
          onPress={() => DocKit.setClipboard(text)}
          accessibilityLabel="Copy code">
          <Text style={styles.copy}>Copy</Text>
        </Pressable>
      </View>
      <Text style={styles.code} selectable>
        {text}
      </Text>
    </View>
  );
}

export default function Markdown({
  content,
  color = colors.textPrimary,
}: {
  content: string;
  color?: string;
}) {
  const blocks = useMemo(() => parse(content), [content]);
  const base = [styles.body, { color }];

  return (
    <View>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'code':
            return <CodeBlock key={i} lang={b.lang} text={b.text} />;
          case 'heading':
            return (
              <Inline
                key={i}
                text={b.text}
                style={[
                  styles.heading,
                  { color, fontSize: Math.max(fontSizes.md, fontSizes.xl - b.level * 2) },
                ]}
              />
            );
          case 'rule':
            return <View key={i} style={styles.rule} />;
          case 'quote':
            return (
              <View key={i} style={styles.quote}>
                <Inline text={b.text} style={[styles.body, styles.quoteText]} />
              </View>
            );
          case 'list':
            return (
              <View key={i} style={styles.list}>
                {b.items.map((item, j) => (
                  <View key={j} style={styles.listRow}>
                    <Text style={[styles.bullet, { color }]}>
                      {b.ordered ? `${j + 1}.` : '•'}
                    </Text>
                    <Inline text={item} style={[...base, styles.listText]} />
                  </View>
                ))}
              </View>
            );
          default:
            return <Inline key={i} text={b.text} style={[...base, styles.para]} />;
        }
      })}
    </View>
  );
}

const mono = 'monospace';

const styles = StyleSheet.create({
  body: {
    fontSize: fontSizes.md,
    lineHeight: 22,
  },
  para: { marginBottom: spacing.sm },
  heading: {
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    lineHeight: 26,
  },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  inlineCode: {
    fontFamily: mono,
    fontSize: fontSizes.sm,
    color: colors.accent,
  },
  codeWrap: {
    backgroundColor: colors.code,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceAlt,
  },
  codeLang: {
    color: colors.textFaint,
    fontSize: fontSizes.xxs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  copy: { color: colors.accent, fontSize: fontSizes.xs, fontWeight: '600' },
  code: {
    fontFamily: mono,
    fontSize: fontSizes.sm,
    color: '#D8E1F0',
    padding: spacing.md,
    lineHeight: 19,
  },
  rule: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accentMuted,
    paddingLeft: spacing.md,
    marginBottom: spacing.sm,
  },
  quoteText: { color: colors.textSecondary, fontStyle: 'italic' },
  list: { marginBottom: spacing.sm },
  listRow: { flexDirection: 'row', marginBottom: spacing.xs },
  bullet: {
    width: 22,
    fontSize: fontSizes.md,
    lineHeight: 22,
  },
  listText: { flex: 1 },
});
