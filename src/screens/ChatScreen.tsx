import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLlama } from '../context/LlamaContext';
import { Attachment, pickAttachments } from '../services/attachments';
import AttachmentChip from '../components/AttachmentChip';
import MessageBubble from '../components/MessageBubble';
import ProgressBar from '../components/ProgressBar';
import { colors, fontSizes, radius, spacing, useLayout } from '../theme';

export default function ChatScreen({
  onGoToModels,
}: {
  onGoToModels: () => void;
}) {
  const {
    loadState,
    activeModel,
    visionEnabled,
    messages,
    isGenerating,
    settings,
    sendMessage,
    stopGenerating,
    regenerate,
    resetChat,
  } = useLlama();

  const layout = useLayout();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const listRef = useRef<FlatList<any>>(null);

  const ready = loadState.status === 'ready';
  const canSend = ready && !isGenerating && (!!draft.trim() || attachments.length > 0);

  // Follow the stream, but only when new content actually arrives.
  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      60,
    );
    return () => clearTimeout(t);
  }, [messages]);

  const handleAttach = useCallback(async (imagesOnly: boolean) => {
    setPickError(null);
    setPicking(true);
    try {
      const picked = await pickAttachments(imagesOnly);
      if (picked.length) setAttachments(prev => [...prev, ...picked]);
    } catch (e: any) {
      setPickError(e?.message ?? 'Could not open the file picker.');
    } finally {
      setPicking(false);
    }
  }, []);

  const handleSend = useCallback(() => {
    const text = draft;
    const files = attachments;
    setDraft('');
    setAttachments([]);
    sendMessage(text, files);
  }, [draft, attachments, sendMessage]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  // ---- states before a model is usable ------------------------------

  if (loadState.status === 'loading') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.centerTitle}>
          Loading {activeModel?.label ?? 'model'}
        </Text>
        <Text style={styles.centerBody}>{loadState.stage}</Text>
        <View style={{ width: layout.contentWidth * 0.7, marginTop: spacing.lg }}>
          <ProgressBar fraction={loadState.progress / 100} />
        </View>
        <Text style={styles.centerHint}>
          The first load of a large model takes the longest — the file has to
          be read off storage before anything can happen.
        </Text>
      </View>
    );
  }

  if (!ready) {
    const failed = loadState.status === 'error';
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.centerEmoji}>{failed ? '⚠️' : '🧠'}</Text>
        <Text style={styles.centerTitle}>
          {failed ? "That model didn't load" : 'No model loaded yet'}
        </Text>
        <Text style={styles.centerBody}>
          {failed
            ? loadState.message
            : 'Download one from the Models tab, or import a .gguf file you already have in your Downloads folder. Everything runs on this device.'}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={onGoToModels}>
          <Text style={styles.primaryBtnText}>
            {failed ? 'Back to models' : 'Choose a model'}
          </Text>
        </Pressable>
      </View>
    );
  }

  // ---- the chat itself ----------------------------------------------

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {activeModel?.label}
          </Text>
          <Text style={styles.headerSub}>
            {visionEnabled ? 'Text, images and documents' : 'Text and documents'}
            {isGenerating ? ' · generating…' : ''}
          </Text>
        </View>
        {messages.length > 0 && (
          <View style={styles.headerActions}>
            {!isGenerating && (
              <Pressable onPress={regenerate} hitSlop={8}>
                <Text style={styles.headerAction}>Retry</Text>
              </Pressable>
            )}
            <Pressable onPress={resetChat} hitSlop={8}>
              <Text style={styles.headerAction}>Clear</Text>
            </Pressable>
          </View>
        )}
      </View>

      <FlatList
        ref={listRef}
        style={styles.flex}
        data={messages}
        keyExtractor={m => m.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.listContent,
          messages.length === 0 && styles.listEmpty,
        ]}
        renderItem={({ item, index }) => (
          <MessageBubble
            message={item}
            maxWidth={layout.bubbleMaxWidth}
            showReasoning={settings.showReasoning}
            streaming={isGenerating && index === messages.length - 1}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.centerEmoji}>👋</Text>
            <Text style={styles.centerTitle}>Ready when you are</Text>
            <Text style={styles.centerBody}>
              Ask anything, or attach a photo, PDF, spreadsheet or document
              and ask about it.
              {!visionEnabled &&
                ' This model reads text but cannot see images — load a vision model if you want to send photos.'}
            </Text>
          </View>
        }
      />

      {!!attachments.length && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.attachStrip}
          contentContainerStyle={styles.attachStripContent}>
          {attachments.map(a => (
            <AttachmentChip
              key={a.id}
              attachment={a}
              onRemove={() => removeAttachment(a.id)}
            />
          ))}
        </ScrollView>
      )}

      {!!pickError && <Text style={styles.pickError}>{pickError}</Text>}

      <View
        style={[
          styles.composer,
          { paddingBottom: spacing.sm + Math.max(insets.bottom - spacing.sm, 0) },
        ]}>
        <View style={styles.composerRow}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => handleAttach(false)}
            disabled={picking || isGenerating}
            accessibilityLabel="Attach a file">
            {picking ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Text style={styles.iconBtnText}>＋</Text>
            )}
          </Pressable>

          {visionEnabled && (
            <Pressable
              style={styles.iconBtn}
              onPress={() => handleAttach(true)}
              disabled={picking || isGenerating}
              accessibilityLabel="Attach an image">
              <Text style={styles.iconBtnText}>🖼</Text>
            </Pressable>
          )}

          <TextInput
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor={colors.textFaint}
            value={draft}
            onChangeText={setDraft}
            editable={!isGenerating}
            multiline
            textAlignVertical="center"
          />

          {isGenerating ? (
            <Pressable style={[styles.sendBtn, styles.stopBtn]} onPress={stopGenerating}>
              <Text style={styles.stopBtnText}>■</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!canSend}>
              <Text style={styles.sendBtnText}>↑</Text>
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  centerEmoji: { fontSize: 38, marginBottom: spacing.md },
  centerTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: '700',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  centerBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 460,
  },
  centerHint: {
    color: colors.textFaint,
    fontSize: fontSizes.xs,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.lg,
    maxWidth: 420,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  primaryBtnText: {
    color: colors.onAccent,
    fontWeight: '700',
    fontSize: fontSizes.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.background,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  headerSub: { color: colors.textFaint, fontSize: fontSizes.xxs, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: spacing.lg },
  headerAction: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  listContent: { paddingVertical: spacing.lg },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  emptyChat: { alignItems: 'center', paddingHorizontal: spacing.xl },
  attachStrip: {
    maxHeight: 78,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  attachStripContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  pickError: {
    color: colors.danger,
    fontSize: fontSizes.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { color: colors.textSecondary, fontSize: 19 },
  input: {
    flex: 1,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    minHeight: 40,
    maxHeight: 140,
    fontSize: fontSizes.md,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.accentMuted },
  sendBtnText: { color: colors.onAccent, fontSize: 20, fontWeight: '700' },
  stopBtn: { backgroundColor: colors.danger },
  stopBtnText: { color: '#fff', fontSize: 14 },
});
