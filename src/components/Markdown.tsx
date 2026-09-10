import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { DocKit } from '../native/DocKit';
import { makeStyles, useColors } from '../context/ThemeContext';
import { fontSizes, radius, spacing } from '../theme';

/**
 * A deliberately small markdown renderer.
 *
 * Pulling in a full markdown library would add a dependency, a bundle-size
 * hit and an upgrade liability, to render the handful of constructs a chat
 * model actually produces: fenced code, headings, lists, tables, quotes,
 * bold, italic, links and inline code. So it's hand-rolled.
 */

type Block =
  | { type: 'code'; lang: string; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'list'; ordered: boolean; items: Array<{ text: string; depth: number }> }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'quote'; text: string }
  | { type: 'rule' }
  | { type: 'para'; text: string };

const BULLET = /^(\s*)([-*+])\s+(.*)$/;
const NUMBERED = /^(\s*)\d+[.)]\s+(.*)$/;

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
}

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

    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    // A table needs a header row and a |---|---| separator underneath it.
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) &&
      lines[i + 1].includes('-')
    ) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', header, rows });
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

    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const items: Array<{ text: string; depth: number }> = [];
      while (i < lines.length) {
        const m = lines[i].match(ordered ? NUMBERED : BULLET);
        if (!m) break;
        const indent = m[1].length;
        items.push({
          text: ordered ? m[2] : m[3],
          depth: Math.min(2, Math.floor(indent / 2)),
        });
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
      !BULLET.test(lines[i]) &&
      !NUMBERED.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'para', text: para.join('\n') });
  }

  return blocks;
}

/** Renders bold / italic / inline-code / strikethrough / links inside a line. */
function Inline({ text, style }: { text: string; style?: any }) {
  const styles = useStyles();
  const parts = useMemo(() => {
    const out: Array<{ t: string; kind: string; href?: string }> = [];
    const re =
      /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(~~[^~]+~~)|(\[[^\]]+\]\([^)]+\))/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ t: text.slice(last, m.index), kind: 'plain' });
      const tok = m[0];
      if (tok.startsWith('`')) out.push({ t: tok.slice(1, -1), kind: 'code' });
      else if (tok.startsWith('[')) {
        const label = tok.slice(1, tok.indexOf(']'));
        const href = tok.slice(tok.indexOf('(') + 1, -1);
        out.push({ t: label, kind: 'link', href });
      } else if (tok.startsWith('**') || tok.startsWith('__'))
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
          onPress={p.href ? () => DocKit.openUrl(p.href!) : undefined}
          style={
            p.kind === 'bold'
              ? styles.bold
              : p.kind === 'italic'
              ? styles.italic
              : p.kind === 'strike'
              ? styles.strike
              : p.kind === 'code'
              ? styles.inlineCode
              : p.kind === 'link'
              ? styles.link
              : undefined
          }>
          {p.t}
        </Text>
      ))}
    </Text>
  );
}

function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const styles = useStyles();
  const [copied, setCopied] = useState(false);

  return (
    <View style={styles.codeWrap}>
      <View style={styles.codeHeader}>
        <Text style={styles.codeLang}>{lang || 'code'}</Text>
        <Pressable
          hitSlop={10}
          onPress={() => {
            DocKit.setClipboard(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          accessibilityLabel="Copy code">
          <Text style={styles.copy}>{copied ? 'Copied' : 'Copy'}</Text>
        </Pressable>
      </View>
      {/* Code is the one thing that must not be re-wrapped: a horizontal
          scroller keeps indentation and long lines intact. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={styles.code} selectable>
          {text}
        </Text>
      </ScrollView>
    </View>
  );
}

function Table({ header, rows }: { header: string[]; rows: string[][] }) {
  const styles = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.table}>
      <View>
        <View style={[styles.tableRow, styles.tableHead]}>
          {header.map((cell, i) => (
            <Inline key={i} text={cell} style={[styles.tableCell, styles.tableHeadCell]} />
          ))}
        </View>
        {rows.map((row, r) => (
          <View key={r} style={styles.tableRow}>
            {row.map((cell, i) => (
              <Inline key={i} text={cell} style={styles.tableCell} />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function Markdown({
  content,
  color,
}: {
  content: string;
  color?: string;
}) {
  const c = useColors();
  const styles = useStyles();
  const blocks = useMemo(() => parse(content), [content]);
  const tint = color ?? c.textPrimary;
  const base = [styles.body, { color: tint }];

  return (
    <View>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'code':
            return <CodeBlock key={i} lang={b.lang} text={b.text} />;
          case 'table':
            return <Table key={i} header={b.header} rows={b.rows} />;
          case 'heading':
            return (
              <Inline
                key={i}
                text={b.text}
                style={[
                  styles.heading,
                  {
                    color: tint,
                    fontSize: Math.max(fontSizes.md, fontSizes.xl - b.level * 2),
                  },
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
                  <View
                    key={j}
                    style={[styles.listRow, { paddingLeft: item.depth * spacing.lg }]}>
                    <Text style={[styles.bullet, { color: tint }]}>
                      {b.ordered ? `${j + 1}.` : '•'}
                    </Text>
                    <Inline text={item.text} style={[...base, styles.listText]} />
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

const useStyles = makeStyles(c => ({
  body: {
    fontSize: fontSizes.md,
    lineHeight: 23,
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
  link: { color: c.accent, textDecorationLine: 'underline' },
  inlineCode: {
    fontFamily: mono,
    fontSize: fontSizes.sm,
    color: c.accent,
  },
  codeWrap: {
    backgroundColor: c.code,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.borderSoft,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: c.codeBar,
  },
  codeLang: {
    color: c.textFaint,
    fontSize: fontSizes.xxs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  copy: { color: c.accent, fontSize: fontSizes.xs, fontWeight: '600' },
  code: {
    fontFamily: mono,
    fontSize: fontSizes.sm,
    color: c.codeText,
    padding: spacing.md,
    lineHeight: 19,
  },
  rule: {
    height: 1,
    backgroundColor: c.border,
    marginVertical: spacing.md,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: c.accentMuted,
    paddingLeft: spacing.md,
    marginBottom: spacing.sm,
  },
  quoteText: { color: c.textSecondary, fontStyle: 'italic' },
  list: { marginBottom: spacing.sm },
  listRow: { flexDirection: 'row', marginBottom: spacing.xs },
  bullet: {
    width: 22,
    fontSize: fontSizes.md,
    lineHeight: 23,
  },
  listText: { flex: 1 },
  table: {
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radius.sm,
  },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.borderSoft },
  tableHead: { borderTopWidth: 0, backgroundColor: c.surfaceAlt },
  tableCell: {
    minWidth: 96,
    maxWidth: 240,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.sm,
    lineHeight: 19,
    color: c.textPrimary,
  },
  tableHeadCell: { fontWeight: '700' },
}));
