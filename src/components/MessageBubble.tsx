import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { ChatMessage } from '../services/conversations';
import { DocKit } from '../native/DocKit';
import AttachmentChip from './AttachmentChip';
import Icon from './Icon';
import Markdown from './Markdown';
import { makeStyles, useColors } from '../context/ThemeContext';
import { fontSizes, radius, spacing } from '../theme';

/**
 * One turn in the conversation.
 *
 * The user's turn is a bubble; the assistant's is not. That asymmetry is
 * deliberate and is what makes a long reply readable on a phone — a wall of
 * text inside a tinted rounded rectangle is harder to scan than the same text
 * set flat on the page, and the alternating alignment already makes clear who
 * said what.
 */

function TypingDots() {
  const styles = useStyles();
  const c = useColors();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 3,
        duration: 1050,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <View style={styles.dots}>
      {[0, 1, 2].map(i => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: c.textFaint,
              opacity: anim.interpolate({
                inputRange: [i - 0.5, i, i + 0.5, i + 1.5, 3],
                outputRange: [0.25, 1, 0.25, 0.25, 0.25],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

function MessageBubble({
  message,
  maxWidth,
  showReasoning,
  showStats,
  streaming,
  onRetry,
  onEdit,
  onContinue,
}: {
  message: ChatMessage;
  maxWidth: number;
  showReasoning: boolean;
  showStats?: boolean;
  streaming?: boolean;
  onRetry?: () => void;
  onEdit?: (text: string) => void;
  onContinue?: () => void;
}) {
  const c = useColors();
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const hasReasoning = !!message.reasoning?.trim();

  const copy = () => {
    DocKit.setClipboard(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (isUser) {
    return (
      <View style={[styles.row, styles.rowUser]}>
        <View style={{ maxWidth, alignItems: 'flex-end' }}>
          {!!message.attachments?.length && (
            <View style={styles.attachments}>
              {message.attachments.map(a => (
                <AttachmentChip key={a.id} attachment={a} compactPreview />
              ))}
            </View>
          )}
          {!!message.content && (
            <Pressable
              onLongPress={copy}
              delayLongPress={280}
              style={styles.bubbleUser}>
              <Text style={styles.userText} selectable>
                {message.content}
              </Text>
            </Pressable>
          )}
          <View style={styles.userActions}>
            {copied && <Text style={styles.copied}>Copied</Text>}
            {!!onEdit && !!message.content && (
              <Pressable
                onPress={() => onEdit(message.content)}
                hitSlop={10}
                accessibilityLabel="Edit and resend">
                <Icon name="edit" size={13} color={c.textFaint} />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={[styles.assistant, { maxWidth }, message.error && styles.errorBox]}>
        {hasReasoning && (showReasoning || expanded) && (
          <View style={styles.reasoning}>
            <Text style={styles.reasoningLabel}>Reasoning</Text>
            <Text style={styles.reasoningText}>{message.reasoning}</Text>
          </View>
        )}

        {!!message.content && (
          <Markdown
            content={message.content}
            color={message.error ? c.danger : c.textPrimary}
          />
        )}

        {!message.content && streaming && (
          <View style={styles.streamingRow}>
            <TypingDots />
            {hasReasoning && <Text style={styles.thinking}>Thinking…</Text>}
          </View>
        )}

        {!!message.truncated && !streaming && !message.error && (
          <View style={styles.truncated}>
            <Text style={styles.truncatedText}>
              Cut off at the length limit — not actually finished.
            </Text>
            {!!onContinue && (
              <Pressable onPress={onContinue} hitSlop={10}>
                <Text style={styles.truncatedAction}>Continue</Text>
              </Pressable>
            )}
          </View>
        )}

        {!!message.content && !streaming && !message.error && (
          <View style={styles.footer}>
            <Pressable onPress={copy} hitSlop={10} style={styles.action}>
              <Icon name={copied ? 'check' : 'copy'} size={13} color={c.textFaint} />
              <Text style={styles.actionText}>{copied ? 'Copied' : 'Copy'}</Text>
            </Pressable>
            {!!onRetry && (
              <Pressable onPress={onRetry} hitSlop={10} style={styles.action}>
                <Icon name="retry" size={13} color={c.textFaint} background={c.background} />
                <Text style={styles.actionText}>Retry</Text>
              </Pressable>
            )}
            {hasReasoning && !showReasoning && (
              <Pressable
                onPress={() => setExpanded(v => !v)}
                hitSlop={10}
                style={styles.action}>
                <Icon name="eye" size={13} color={c.textFaint} />
                <Text style={styles.actionText}>
                  {expanded ? 'Hide reasoning' : 'Reasoning'}
                </Text>
              </Pressable>
            )}
            {showStats && !!message.tps && (
              <Text style={styles.stat}>{message.tps.toFixed(1)} tok/s</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Only the streaming message changes while a reply is generating; without
 * this every finished message in a long chat re-renders on each repaint.
 */
export default memo(MessageBubble, (prev, next) => {
  return (
    prev.message === next.message &&
    prev.streaming === next.streaming &&
    prev.showReasoning === next.showReasoning &&
    prev.showStats === next.showStats &&
    prev.maxWidth === next.maxWidth &&
    !!prev.onRetry === !!next.onRetry &&
    !!prev.onEdit === !!next.onEdit &&
    !!prev.onContinue === !!next.onContinue
  );
});

const useStyles = makeStyles(c => ({
  row: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
  },
  rowUser: { justifyContent: 'flex-end' },
  bubbleUser: {
    backgroundColor: c.bubbleUser,
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  userText: {
    color: c.bubbleUserText,
    fontSize: fontSizes.md,
    lineHeight: 22,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingRight: spacing.xxs,
    minHeight: 14,
  },
  copied: { color: c.textFaint, fontSize: fontSizes.xxs },
  assistant: { flex: 1 },
  errorBox: {
    borderWidth: 1,
    borderColor: c.danger,
    backgroundColor: c.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  attachments: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
  streamingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dots: { flexDirection: 'row', gap: 5, paddingVertical: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
  thinking: {
    color: c.textFaint,
    fontSize: fontSizes.xs,
    fontStyle: 'italic',
  },
  reasoning: {
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: c.accentMuted,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  reasoningLabel: {
    color: c.textFaint,
    fontSize: fontSizes.xxs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  reasoningText: {
    color: c.textSecondary,
    fontSize: fontSizes.xs,
    lineHeight: 19,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionText: { color: c.textFaint, fontSize: fontSizes.xs, fontWeight: '600' },
  stat: { color: c.textFaint, fontSize: fontSizes.xxs, marginLeft: 'auto' },
  truncated: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: c.warningSoft,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  truncatedText: { color: c.warning, fontSize: fontSizes.xxs, flexShrink: 1 },
  truncatedAction: { color: c.warning, fontSize: fontSizes.xs, fontWeight: '700' },
}));
