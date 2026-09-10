import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import Sheet, { SheetRow } from './Sheet';
import {
  Conversation,
  groupConversations,
  searchConversations,
} from '../services/conversations';
import { makeStyles, useColors } from '../context/ThemeContext';
import { duration, fontSizes, radius, spacing, useLayout } from '../theme';

/**
 * Conversation drawer.
 *
 * Slides in from the left, over the chat, the way every messaging app on the
 * platform does it. Built on Animated and a plain Modal-free overlay so it
 * needs no gesture or navigation library — this app's build has to keep
 * working on CI, and every native dependency is one more thing that can stop
 * it doing so.
 */

export type DrawerDestination = 'chat' | 'models' | 'settings';

export default function Drawer({
  open,
  progress,
  conversations,
  activeId,
  modelLabel,
  onClose,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
  onDeleteAll,
  onNavigate,
}: {
  open: boolean;
  /** 0..1, shared with the swipe gesture in the app shell. */
  progress: Animated.Value;
  conversations: Conversation[];
  activeId?: string;
  modelLabel?: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onNavigate: (to: DrawerDestination) => void;
}) {
  const c = useColors();
  const styles = useStyles();
  const layout = useLayout();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<Conversation | null>(null);
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? duration.normal : duration.fast,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const groups = useMemo(
    () => groupConversations(searchConversations(conversations, query)),
    [conversations, query],
  );

  const width = layout.drawerWidth;

  return (
    <>
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[
          styles.scrim,
          {
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
          },
        ]}>
        <Pressable style={styles.scrimPress} onPress={onClose} />
      </Animated.View>

      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[
          styles.panel,
          {
            width,
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-width - 12, 0],
                }),
              },
            ],
          },
        ]}>
        <View style={styles.head}>
          <Text style={styles.brand}>Offline AI</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.iconBtn}>
            <Icon name="close" size={13} color={c.textSecondary} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            onNewChat();
            onClose();
          }}
          style={({ pressed }) => [styles.newChat, pressed && styles.pressed]}>
          <Icon name="compose" size={16} color={c.accent} />
          <Text style={styles.newChatText}>New chat</Text>
        </Pressable>

        <View style={styles.searchBox}>
          <Icon name="search" size={14} color={c.textFaint} />
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats"
            placeholderTextColor={c.textFaint}
            returnKeyType="search"
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Icon name="close" size={11} color={c.textFaint} />
            </Pressable>
          )}
        </View>

        <ScrollView
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {groups.length === 0 && (
            <Text style={styles.empty}>
              {query ? 'Nothing matches that.' : 'No conversations yet.'}
            </Text>
          )}
          {groups.map(group => (
            <View key={group.label}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              {group.items.map(conv => {
                const active = conv.id === activeId;
                return (
                  <Pressable
                    key={conv.id}
                    onPress={() => {
                      onSelect(conv.id);
                      onClose();
                    }}
                    onLongPress={() => setMenuFor(conv)}
                    delayLongPress={260}
                    style={({ pressed }) => [
                      styles.conv,
                      active && styles.convActive,
                      pressed && styles.pressed,
                    ]}>
                    <View style={styles.convText}>
                      <Text
                        style={[styles.convTitle, active && styles.convTitleActive]}
                        numberOfLines={1}>
                        {conv.title}
                      </Text>
                      <Text style={styles.convMeta} numberOfLines={1}>
                        {conv.messages.length
                          ? `${conv.messages.length} messages${
                              conv.modelLabel ? ` · ${conv.modelLabel}` : ''
                            }`
                          : 'Empty'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setMenuFor(conv)}
                      hitSlop={10}
                      style={styles.convMore}>
                      <Icon name="more" size={13} color={c.textFaint} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={{ height: spacing.xl }} />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => {
              onNavigate('models');
              onClose();
            }}
            style={({ pressed }) => [styles.footRow, pressed && styles.pressed]}>
            <Icon name="chip" size={17} color={c.textSecondary} />
            <View style={styles.footText}>
              <Text style={styles.footLabel}>Models</Text>
              <Text style={styles.footMeta} numberOfLines={1}>
                {modelLabel ?? 'None loaded'}
              </Text>
            </View>
            <Icon name="chevronRight" size={13} color={c.textFaint} />
          </Pressable>
          <Pressable
            onPress={() => {
              onNavigate('settings');
              onClose();
            }}
            style={({ pressed }) => [styles.footRow, pressed && styles.pressed]}>
            <Icon name="sliders" size={17} color={c.textSecondary} />
            <View style={styles.footText}>
              <Text style={styles.footLabel}>Settings</Text>
            </View>
            <Icon name="chevronRight" size={13} color={c.textFaint} />
          </Pressable>
        </View>
      </Animated.View>

      <Sheet
        visible={!!menuFor}
        title={menuFor?.title}
        subtitle={
          menuFor
            ? `${menuFor.messages.length} messages · updated ${new Date(
                menuFor.updatedAt,
              ).toLocaleDateString()}`
            : undefined
        }
        onClose={() => setMenuFor(null)}>
        <SheetRow
          icon="edit"
          label="Rename"
          onPress={() => {
            setRenaming(menuFor);
            setDraftTitle(menuFor?.title ?? '');
            setMenuFor(null);
          }}
        />
        <SheetRow
          icon="trash"
          label="Delete chat"
          danger
          onPress={() => {
            if (menuFor) onDelete(menuFor.id);
            setMenuFor(null);
          }}
        />
        <SheetRow
          icon="trash"
          label="Delete all chats"
          detail="Clears the whole history on this device."
          danger
          onPress={() => {
            setMenuFor(null);
            setConfirmClear(true);
          }}
        />
      </Sheet>

      <Sheet
        visible={!!renaming}
        title="Rename chat"
        onClose={() => setRenaming(null)}>
        <TextInput
          style={styles.renameInput}
          value={draftTitle}
          onChangeText={setDraftTitle}
          autoFocus
          placeholder="Chat name"
          placeholderTextColor={c.textFaint}
          onSubmitEditing={() => {
            if (renaming) onRename(renaming.id, draftTitle);
            setRenaming(null);
          }}
        />
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            if (renaming) onRename(renaming.id, draftTitle);
            setRenaming(null);
          }}>
          <Text style={styles.primaryBtnText}>Save</Text>
        </Pressable>
      </Sheet>

      <Sheet
        visible={confirmClear}
        title="Delete every chat?"
        subtitle="This cannot be undone. Models and settings are not touched."
        onClose={() => setConfirmClear(false)}>
        <SheetRow
          icon="trash"
          label="Delete all conversations"
          danger
          onPress={() => {
            onDeleteAll();
            setConfirmClear(false);
          }}
        />
        <SheetRow icon="close" label="Keep them" onPress={() => setConfirmClear(false)} />
      </Sheet>
    </>
  );
}

const useStyles = makeStyles(c => ({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.scrim,
    zIndex: 20,
  },
  scrimPress: { flex: 1 },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 21,
    backgroundColor: c.surface,
    borderRightWidth: 1,
    borderRightColor: c.borderSoft,
    paddingHorizontal: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
  },
  brand: { color: c.textPrimary, fontSize: fontSizes.lg, fontWeight: '700' },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  newChatText: { color: c.accent, fontSize: fontSizes.md, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  search: {
    flex: 1,
    color: c.textPrimary,
    fontSize: fontSizes.sm,
    paddingVertical: spacing.sm + 2,
  },
  list: { flex: 1, marginTop: spacing.sm },
  empty: {
    color: c.textFaint,
    fontSize: fontSizes.xs,
    padding: spacing.md,
  },
  groupLabel: {
    color: c.textFaint,
    fontSize: fontSizes.xxs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  conv: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  convActive: { backgroundColor: c.highlight },
  convText: { flex: 1, minWidth: 0 },
  convTitle: { color: c.textPrimary, fontSize: fontSizes.sm, fontWeight: '600' },
  convTitleActive: { color: c.accent },
  convMeta: { color: c.textFaint, fontSize: fontSizes.xxs, marginTop: 1 },
  convMore: { paddingLeft: spacing.sm },
  footer: {
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    paddingTop: spacing.sm,
  },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  footText: { flex: 1, minWidth: 0 },
  footLabel: { color: c.textPrimary, fontSize: fontSizes.sm, fontWeight: '600' },
  footMeta: { color: c.textFaint, fontSize: fontSizes.xxs, marginTop: 1 },
  renameInput: {
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    color: c.textPrimary,
    fontSize: fontSizes.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    margin: spacing.md,
  },
  primaryBtn: {
    backgroundColor: c.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  primaryBtnText: { color: c.onAccent, fontSize: fontSizes.sm, fontWeight: '700' },
}));
