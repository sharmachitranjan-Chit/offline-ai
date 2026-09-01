import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChatMessage } from '../context/LlamaContext';
import { DocKit } from '../native/DocKit';
import AttachmentChip from './AttachmentChip';
import Markdown from './Markdown';
import { colors, fontSizes, radius, spacing } from '../theme';

export default function MessageBubble({
  message,
  maxWidth,
  showReasoning,
  streaming,
  onContinue,
}: {
  message: ChatMessage;
  maxWidth: number;
  showReasoning: boolean;
  streaming?: boolean;
  onContinue?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isUser = message.role === 'user';
  const hasReasoning = !!message.reasoning?.trim();

  return (
    <View
      style={[
        styles.row,
        isUser ? styles.rowUser : styles.rowAssistant,
      ]}>
      <View
        style={[
          styles.bubble,
          { maxWidth },
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          message.error && styles.bubbleError,
        ]}>
        {!!message.attachments?.length && (
          <View style={styles.attachments}>
            {message.attachments.map(a => (
              <AttachmentChip key={a.id} attachment={a} compactPreview />
            ))}
          </View>
        )}

        {hasReasoning && (showReasoning || expanded) && (
          <View style={styles.reasoning}>
            <Text style={styles.reasoningLabel}>Reasoning</Text>
            <Text style={styles.reasoningText}>{message.reasoning}</Text>
          </View>
        )}

        {!!message.content && (
          isUser ? (
            <Text style={styles.userText} selectable>
              {message.content}
            </Text>
          ) : (
            <Markdown content={message.content} />
          )
        )}

        {!message.content && streaming && (
          <Text style={styles.thinking}>
            {hasReasoning ? 'Thinking…' : 'Generating…'}
          </Text>
        )}

        {!isUser && message.truncated && !streaming && (
          <View style={styles.truncatedNotice}>
            <Text style={styles.truncatedText}>
              ⚠ Cut off at the length limit, not actually finished.
            </Text>
            {!!onContinue && (
              <Pressable onPress={onContinue} hitSlop={8}>
                <Text style={styles.truncatedAction}>Continue →</Text>
              </Pressable>
            )}
          </View>
        )}

        {!isUser && !!message.content && !streaming && (
          <View style={styles.footer}>
            {hasReasoning && !showReasoning && (
              <Pressable onPress={() => setExpanded(v => !v)} hitSlop={8}>
                <Text style={styles.action}>
                  {expanded ? 'Hide reasoning' : 'Show reasoning'}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => DocKit.setClipboard(message.content)}
              hitSlop={8}>
              <Text style={styles.action}>Copy</Text>
            </Pressable>
            {!!message.tps && (
              <Text style={styles.stat}>{message.tps.toFixed(1)} tok/s</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
  },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bubble: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  bubbleUser: {
    backgroundColor: colors.bubbleUser,
    borderBottomRightRadius: radius.xs,
  },
  bubbleAssistant: {
    backgroundColor: colors.bubbleAssistant,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderBottomLeftRadius: radius.xs,
  },
  bubbleError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  attachments: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
  userText: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    lineHeight: 21,
  },
  thinking: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    fontStyle: 'italic',
  },
  reasoning: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.xs,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  reasoningLabel: {
    color: colors.textFaint,
    fontSize: fontSizes.xxs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  reasoningText: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  action: { color: colors.textFaint, fontSize: fontSizes.xs, fontWeight: '600' },
  truncatedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.warningSoft,
    borderRadius: radius.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  truncatedText: {
    color: colors.warning,
    fontSize: fontSizes.xxs,
    flexShrink: 1,
  },
  truncatedAction: {
    color: colors.warning,
    fontSize: fontSizes.xxs,
    fontWeight: '700',
  },
  stat: { color: colors.textFaint, fontSize: fontSizes.xxs, marginLeft: 'auto' },
});
