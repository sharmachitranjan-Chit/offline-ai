import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import Composer from '../components/Composer';
import Icon from '../components/Icon';
import MessageBubble from '../components/MessageBubble';
import ProgressBar from '../components/ProgressBar';
import Sheet, { SheetRow, SheetSection } from '../components/Sheet';
import TopBar from '../components/TopBar';
import { useLlama } from '../context/LlamaContext';
import { MODEL_CATALOG } from '../data/modelCatalog';
import { ChatMessage } from '../services/conversations';
import { Attachment, pickAttachments } from '../services/attachments';
import { formatBytes } from '../services/modelManager';
import { makeStyles, useColors } from '../context/ThemeContext';
import { fontSizes, radius, spacing, useLayout } from '../theme';

const SUGGESTIONS = [
  'Explain this in simple terms:',
  'Summarise the document I am attaching',
  'Draft a polite reply to this message:',
  'What is wrong with this code?',
];

export default function ChatScreen({
  onOpenDrawer,
  onOpenModels,
}: {
  onOpenDrawer: () => void;
  onOpenModels: () => void;
}) {
  const {
    loadState,
    activeModel,
    installed,
    visionEnabled,
    messages,
    isGenerating,
    settings,
    sendMessage,
    editMessage,
    stopGenerating,
    regenerate,
    newChat,
    loadModel,
  } = useLlama();

  const c = useColors();
  const styles = useStyles();
  const layout = useLayout();

  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const ready = loadState.status === 'ready';

  // Follow the stream, but never yank the view away from someone who has
  // scrolled up to read something earlier.
  useEffect(() => {
    if (!messages.length || !atBottom) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages, atBottom]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distance = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setAtBottom(distance < 90);
  }, []);

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
    setAtBottom(true);
    if (editingId) {
      const id = editingId;
      setEditingId(null);
      editMessage(id, text);
      return;
    }
    sendMessage(text, files);
  }, [draft, attachments, editingId, editMessage, sendMessage]);

  const startEdit = useCallback((id: string, text: string) => {
    setEditingId(id);
    setDraft(text);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  // ---- loading a model ----------------------------------------------

  if (loadState.status === 'loading') {
    return (
      <View style={styles.flex}>
        <TopBar
          title="Loading model"
          subtitle={activeModel?.label}
          onLeading={onOpenDrawer}
        />
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
          <Text style={styles.centerTitle}>{activeModel?.label ?? 'Model'}</Text>
          <Text style={styles.centerBody}>{loadState.stage}</Text>
          <View style={{ width: layout.contentWidth * 0.7, marginTop: spacing.lg }}>
            <ProgressBar fraction={loadState.progress / 100} />
          </View>
          <Text style={styles.centerHint}>
            The first load of a large model takes the longest — the whole file
            has to be read off storage before anything can happen.
          </Text>
        </View>
      </View>
    );
  }

  // ---- nothing loaded yet -------------------------------------------

  if (!ready) {
    const failed = loadState.status === 'error';
    return (
      <View style={styles.flex}>
        <TopBar
          title="Offline AI"
          subtitle={failed ? 'Model failed to load' : 'No model loaded'}
          onLeading={onOpenDrawer}
        />
        <View style={styles.center}>
          <View style={[styles.badge, failed && styles.badgeBad]}>
            <Icon
              name={failed ? 'info' : 'chip'}
              size={26}
              color={failed ? c.danger : c.accent}
            />
          </View>
          <Text style={styles.centerTitle}>
            {failed ? "That model didn't load" : 'Choose a model to begin'}
          </Text>
          <Text style={styles.centerBody}>
            {failed
              ? loadState.message
              : installed.length
              ? 'You have models ready — pick one and it stays loaded until you change it.'
              : 'Download one from the Models screen, or copy any .gguf into your models folder and it will show up here.'}
          </Text>

          {installed.length > 0 && (
            <View style={styles.readyList}>
              {installed.slice(0, 4).map(m => (
                <Pressable
                  key={m.id}
                  style={({ pressed }) => [styles.readyRow, pressed && styles.pressed]}
                  onPress={() => loadModel(m)}>
                  <Icon name="chip" size={16} color={c.textSecondary} />
                  <View style={styles.flex}>
                    <Text style={styles.readyName} numberOfLines={1}>
                      {m.label}
                    </Text>
                    <Text style={styles.readyMeta}>
                      {formatBytes(m.sizeBytes)}
                      {m.mmprojPath ? ' · sees images' : ''}
                    </Text>
                  </View>
                  <Text style={styles.readyAction}>Load</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable style={styles.primaryBtn} onPress={onOpenModels}>
            <Text style={styles.primaryBtnText}>
              {installed.length ? 'Browse all models' : 'Get a model'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- the chat itself ------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>
      <TopBar
        title={activeModel?.label ?? 'Offline AI'}
        subtitle={`${visionEnabled ? 'Text, images and documents' : 'Text and documents'}${
          isGenerating ? ' · generating…' : ''
        }`}
        onLeading={onOpenDrawer}
        onTitlePress={() => setSwitcherOpen(true)}
        actions={[
          {
            icon: 'compose',
            label: 'New chat',
            onPress: () => {
              newChat();
              setDraft('');
              setAttachments([]);
              setEditingId(null);
            },
          },
        ]}
      />

      <View style={styles.flex}>
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={messages}
          keyExtractor={m => m.id}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={64}
          removeClippedSubviews={false}
          contentContainerStyle={[
            styles.listContent,
            messages.length === 0 && styles.listEmpty,
          ]}
          renderItem={({ item, index }) => (
            <MessageBubble
              message={item}
              maxWidth={layout.bubbleMaxWidth}
              showReasoning={settings.showReasoning}
              showStats={settings.showStats}
              streaming={isGenerating && index === messages.length - 1}
              onRetry={
                index === messages.length - 1 && !isGenerating ? regenerate : undefined
              }
              onEdit={
                item.role === 'user' && !isGenerating
                  ? text => startEdit(item.id, text)
                  : undefined
              }
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyTitle}>Ready when you are</Text>
              <Text style={styles.emptyBody}>
                Everything runs on this phone. Ask anything, or attach a photo,
                PDF, spreadsheet or document and ask about it.
                {!visionEnabled &&
                  ' This model reads text but cannot see images — load a vision model if you want to send photos.'}
              </Text>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map(s => (
                  <Pressable
                    key={s}
                    style={({ pressed }) => [
                      styles.suggestion,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setDraft(`${s} `)}>
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
        />

        {!atBottom && messages.length > 2 && (
          <Pressable
            style={styles.jump}
            onPress={() => {
              setAtBottom(true);
              listRef.current?.scrollToEnd({ animated: true });
            }}
            accessibilityLabel="Jump to the latest message">
            <Icon name="arrowDown" size={15} color={c.textPrimary} />
          </Pressable>
        )}
      </View>

      <Composer
        value={draft}
        onChangeText={setDraft}
        attachments={attachments}
        onRemoveAttachment={removeAttachment}
        onPickFiles={() => handleAttach(false)}
        onPickImages={() => handleAttach(true)}
        onSend={handleSend}
        onStop={stopGenerating}
        isGenerating={isGenerating}
        picking={picking}
        visionEnabled={visionEnabled}
        editing={!!editingId}
        onCancelEdit={() => {
          setEditingId(null);
          setDraft('');
        }}
        error={pickError}
      />

      <Sheet
        visible={switcherOpen}
        title="Model"
        subtitle="One model is held in memory at a time; switching unloads the previous one."
        onClose={() => setSwitcherOpen(false)}>
        <SheetSection label="Ready on this device" />
        {installed.map(m => (
          <SheetRow
            key={m.id}
            icon="chip"
            label={m.label}
            detail={`${formatBytes(m.sizeBytes)}${
              m.mmprojPath ? ' · sees images' : ''
            }${m.external ? ' · outside the models folder' : ''}`}
            selected={activeModel?.id === m.id}
            onPress={() => {
              setSwitcherOpen(false);
              if (activeModel?.id !== m.id) loadModel(m);
            }}
          />
        ))}
        {installed.length === 0 && (
          <SheetRow icon="info" label="No models installed yet" disabled />
        )}
        <SheetSection label="More" />
        <SheetRow
          icon="download"
          label="Browse the catalog"
          detail={`${MODEL_CATALOG.length} models with direct download links, from 400 MB upwards.`}
          onPress={() => {
            setSwitcherOpen(false);
            onOpenModels();
          }}
        />
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(c => ({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeBad: { backgroundColor: c.dangerSoft },
  centerTitle: {
    color: c.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: '700',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  centerBody: {
    color: c.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 460,
  },
  centerHint: {
    color: c.textFaint,
    fontSize: fontSizes.xs,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.lg,
    maxWidth: 420,
  },
  readyList: { alignSelf: 'stretch', marginTop: spacing.lg, maxWidth: 460 },
  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  readyName: { color: c.textPrimary, fontSize: fontSizes.sm, fontWeight: '600' },
  readyMeta: { color: c.textFaint, fontSize: fontSizes.xxs, marginTop: 1 },
  readyAction: { color: c.accent, fontSize: fontSizes.xs, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  primaryBtn: {
    backgroundColor: c.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  primaryBtnText: { color: c.onAccent, fontWeight: '700', fontSize: fontSizes.sm },
  listContent: { paddingVertical: spacing.lg },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  emptyChat: { alignItems: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: {
    color: c.textPrimary,
    fontSize: fontSizes.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    color: c.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 420,
  },
  suggestions: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
    maxWidth: 460,
    gap: spacing.sm,
  },
  suggestion: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  suggestionText: { color: c.textSecondary, fontSize: fontSizes.sm },
  jump: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceHigh,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
