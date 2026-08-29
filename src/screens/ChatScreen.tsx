import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLlama } from '../context/LlamaContext';
import MessageBubble from '../components/MessageBubble';
import { colors, fontSizes, radius, spacing } from '../theme';

export default function ChatScreen({
  onGoToModels,
}: {
  onGoToModels: () => void;
}) {
  const { loadState, activeModel, messages, isGenerating, sendMessage, stopGenerating, resetChat } =
    useLlama();
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList>(null);

  const handleSend = useCallback(() => {
    const text = draft;
    setDraft('');
    sendMessage(text);
  }, [draft, sendMessage]);

  const canChat = loadState.status === 'ready';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Offline AI</Text>
          <Text style={styles.subtitle}>
            {canChat
              ? activeModel?.label
              : loadState.status === 'loading'
              ? `Loading ${activeModel?.label ?? 'model'}…`
              : 'No model loaded'}
          </Text>
        </View>
        {messages.length > 0 && (
          <Pressable onPress={resetChat} hitSlop={8}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {!canChat ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🧠</Text>
          <Text style={styles.emptyTitle}>
            {loadState.status === 'loading'
              ? 'Loading model…'
              : 'Pick a model to get started'}
          </Text>
          <Text style={styles.emptyBody}>
            {loadState.status === 'loading'
              ? 'This can take a few seconds the first time.'
              : 'Everything runs locally on your phone — download a free open-source model once, then chat fully offline.'}
          </Text>
          {loadState.status !== 'loading' && (
            <Pressable style={styles.primaryButton} onPress={onGoToModels}>
              <Text style={styles.primaryButtonText}>Browse models</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>👋</Text>
              <Text style={styles.emptyTitle}>Say hello</Text>
              <Text style={styles.emptyBody}>
                Ask anything — replies are generated entirely on this
                device, no data leaves your phone.
              </Text>
            </View>
          }
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={canChat ? 'Message…' : 'Load a model first'}
            placeholderTextColor={colors.textSecondary}
            value={draft}
            onChangeText={setDraft}
            editable={canChat && !isGenerating}
            multiline
          />
          {isGenerating ? (
            <Pressable style={styles.stopButton} onPress={stopGenerating}>
              <Text style={styles.sendButtonText}>Stop</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.sendButton,
                (!canChat || !draft.trim()) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!canChat || !draft.trim()}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  clearText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl * 2,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  primaryButtonText: {
    color: '#0A1830',
    fontWeight: '700',
    fontSize: fontSizes.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 120,
    fontSize: fontSizes.md,
    marginRight: spacing.sm,
  },
  sendButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: colors.accentMuted,
  },
  stopButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendButtonText: {
    color: '#0A1830',
    fontWeight: '700',
    fontSize: fontSizes.sm,
  },
});
