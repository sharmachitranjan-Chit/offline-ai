/**
 * Offline AI — a local-first assistant.
 *
 * Everything happens on the device: text, image understanding, and reading
 * PDFs and office documents. The only network traffic is fetching a model
 * file, and even that is optional — you can supply your own.
 *
 * The shell here is a chat screen with a conversation drawer over it, and
 * Models and Settings as full screens pushed on top. No navigation library:
 * three destinations and a drawer do not need one, and every native
 * dependency is one more thing that can break the CI build.
 *
 * @format
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  PanResponder,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { LlamaProvider, useLlama } from './src/context/LlamaContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import ChatScreen from './src/screens/ChatScreen';
import ModelsScreen from './src/screens/ModelsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import Drawer, { DrawerDestination } from './src/components/Drawer';
import { useLayout } from './src/theme';

function Shell() {
  const {
    conversations,
    activeConversation,
    activeModel,
    newChat,
    selectChat,
    renameChat,
    deleteChat,
    deleteAllChats,
  } = useLlama();
  const { colors, dark } = useTheme();
  const layout = useLayout();

  const [screen, setScreen] = useState<DrawerDestination>('chat');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerProgress = useRef(new Animated.Value(0)).current;

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Android's back button: close the drawer, then leave a sub-screen, then
  // let the system take it. The drawer registers its own handler first.
  useEffect(() => {
    if (screen === 'chat') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setScreen('chat');
      return true;
    });
    return () => sub.remove();
  }, [screen]);

  /**
   * Edge swipe to open the drawer.
   *
   * Only the left ~22dp responds, and only to a clearly horizontal drag, so
   * it never competes with scrolling the conversation.
   */
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderMove: (_e, g) => {
        const fraction = Math.max(0, Math.min(1, g.dx / layout.drawerWidth));
        drawerProgress.setValue(fraction);
      },
      onPanResponderRelease: (_e, g) => {
        const opened = g.dx > layout.drawerWidth * 0.4 || g.vx > 0.5;
        setDrawerOpen(opened);
        Animated.timing(drawerProgress, {
          toValue: opened ? 1 : 0,
          duration: 160,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* The bar colour itself is set natively (DocKit.setSystemBars), since
          RN 0.87 draws edge-to-edge and no longer takes a backgroundColor. */}
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      <View style={styles.flex}>
        {screen === 'chat' && (
          <ChatScreen
            onOpenDrawer={openDrawer}
            onOpenModels={() => setScreen('models')}
          />
        )}
        {screen === 'models' && (
          <ModelsScreen
            onBack={() => setScreen('chat')}
            onLoaded={() => setScreen('chat')}
          />
        )}
        {screen === 'settings' && <SettingsScreen onBack={() => setScreen('chat')} />}
      </View>

      {/* The grab strip sits above the screen but below the drawer. */}
      {screen === 'chat' && !drawerOpen && (
        <View style={styles.edge} {...pan.panHandlers} />
      )}

      <Drawer
        open={drawerOpen}
        progress={drawerProgress}
        conversations={conversations}
        activeId={activeConversation?.id}
        modelLabel={activeModel?.label}
        onClose={closeDrawer}
        onSelect={id => {
          selectChat(id);
          setScreen('chat');
        }}
        onNewChat={() => {
          newChat();
          setScreen('chat');
        }}
        onRename={renameChat}
        onDelete={deleteChat}
        onDeleteAll={deleteAllChats}
        onNavigate={setScreen}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <LlamaProvider>
          <Shell />
        </LlamaProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  edge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 22,
    zIndex: 10,
  },
});
