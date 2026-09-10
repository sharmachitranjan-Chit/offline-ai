import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AttachmentChip from './AttachmentChip';
import Icon from './Icon';
import Sheet, { SheetRow } from './Sheet';
import { Attachment } from '../services/attachments';
import { makeStyles, useColors } from '../context/ThemeContext';
import { fontSizes, radius, spacing } from '../theme';

/**
 * The composer.
 *
 * Attachments live above the input as removable chips, the plus button opens
 * a sheet rather than guessing what the user meant, and the send button
 * becomes a stop button while a reply is streaming — the same control in the
 * same place, so interrupting is one tap and never a hunt.
 */
export default function Composer({
  value,
  onChangeText,
  attachments,
  onRemoveAttachment,
  onPickFiles,
  onPickImages,
  onSend,
  onStop,
  isGenerating,
  picking,
  disabled,
  disabledHint,
  visionEnabled,
  editing,
  onCancelEdit,
  error,
}: {
  value: string;
  onChangeText: (t: string) => void;
  attachments: Attachment[];
  onRemoveAttachment: (id: string) => void;
  onPickFiles: () => void;
  onPickImages: () => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
  picking: boolean;
  disabled?: boolean;
  disabledHint?: string;
  visionEnabled: boolean;
  editing?: boolean;
  onCancelEdit?: () => void;
  error?: string | null;
}) {
  const c = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [attachOpen, setAttachOpen] = useState(false);

  const canSend = !disabled && !isGenerating && (!!value.trim() || attachments.length > 0);

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: spacing.sm + Math.max(insets.bottom - spacing.sm, 0) },
      ]}>
      {!!editing && (
        <View style={styles.editBanner}>
          <Icon name="edit" size={12} color={c.accent} />
          <Text style={styles.editText}>
            Editing your message — sending replaces everything after it.
          </Text>
          <Pressable onPress={onCancelEdit} hitSlop={10}>
            <Icon name="close" size={11} color={c.textSecondary} />
          </Pressable>
        </View>
      )}

      {!!attachments.length && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}>
          {attachments.map(a => (
            <AttachmentChip
              key={a.id}
              attachment={a}
              onRemove={() => onRemoveAttachment(a.id)}
            />
          ))}
        </ScrollView>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!disabled && !!disabledHint && <Text style={styles.hint}>{disabledHint}</Text>}

      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          onPress={() => setAttachOpen(true)}
          disabled={picking || isGenerating || disabled}
          accessibilityLabel="Add an attachment">
          {picking ? (
            <ActivityIndicator size="small" color={c.textSecondary} />
          ) : (
            <Icon name="plus" size={17} color={c.textSecondary} />
          )}
        </Pressable>

        <TextInput
          style={styles.input}
          placeholder={disabled ? 'Load a model to start' : 'Message…'}
          placeholderTextColor={c.textFaint}
          value={value}
          onChangeText={onChangeText}
          editable={!isGenerating && !disabled}
          multiline
          textAlignVertical="center"
        />

        {isGenerating ? (
          <Pressable
            style={[styles.sendBtn, styles.stopBtn]}
            onPress={onStop}
            accessibilityLabel="Stop generating">
            <Icon name="stop" size={13} color={c.onAccent} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.sendBtn, !canSend && styles.sendDisabled]}
            onPress={onSend}
            disabled={!canSend}
            accessibilityLabel="Send">
            <Icon
              name="arrowUp"
              size={18}
              color={canSend ? c.onAccent : c.textFaint}
            />
          </Pressable>
        )}
      </View>

      <Sheet
        visible={attachOpen}
        title="Add to this message"
        subtitle="Everything is read on the device — nothing is uploaded."
        onClose={() => setAttachOpen(false)}>
        <SheetRow
          icon="image"
          label="Photos and screenshots"
          detail={
            visionEnabled
              ? 'The model looks at the image directly.'
              : 'This model cannot see images — load a vision model first.'
          }
          disabled={!visionEnabled}
          onPress={() => {
            setAttachOpen(false);
            onPickImages();
          }}
        />
        <SheetRow
          icon="file"
          label="Documents and files"
          detail="PDF, Word, Excel, PowerPoint, text, CSV, code. Text is extracted; a scanned PDF is rendered to images for a vision model."
          onPress={() => {
            setAttachOpen(false);
            onPickFiles();
          }}
        />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.accentSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  editText: { flex: 1, color: c.accent, fontSize: fontSizes.xs },
  strip: { paddingBottom: spacing.xs },
  error: {
    color: c.danger,
    fontSize: fontSizes.xs,
    paddingBottom: spacing.xs,
  },
  hint: {
    color: c.textFaint,
    fontSize: fontSizes.xs,
    paddingBottom: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  input: {
    flex: 1,
    color: c.textPrimary,
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    minHeight: 40,
    maxHeight: 150,
    fontSize: fontSizes.md,
    lineHeight: 21,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: c.surfaceHigh },
  stopBtn: { backgroundColor: c.danger },
}));
