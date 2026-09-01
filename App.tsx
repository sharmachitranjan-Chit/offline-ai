/**
 * Offline AI — a local-first assistant.
 *
 * Everything happens on the device: text, image understanding, and reading
 * PDFs and office documents. The only network traffic is fetching a model
 * file, and even that is optional — you can supply your own.
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { BackHandler, StatusBar, StyleSheet, View } from 'react-native';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { LlamaProvider, useLlama } from './src/context/LlamaContext';
import ChatScreen from './src/screens/ChatScreen';
import ModelsScreen from './src/screens/ModelsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NavBar, { TabKey } from './src/components/NavBar';
import ErrorBoundary from './src/components/ErrorBoundary';
import { installGlobalCrashLogging, logEvent } from './src/services/diagnostics';
import { colors, useLayout } from './src/theme';

installGlobalCrashLogging();

function Root() {
  const [tab, setTab] = useState<TabKey>('chat');
  const { loadState } = useLlama();
  const layout = useLayout();

  const ready = loadState.status === 'ready';

  // The hardware back button has no JS handler by default on the root
  // screen, which leaves Android free to finish() the Activity rather than
  // just backgrounding it — and finishing it tears down the native llama
  // context along with everything else, so the loaded model is gone next
  // time the app opens. Handling it explicitly keeps that from being a
  // matter of chance: from a sub-tab it returns to Chat, and only backs
  // out of the app (backgrounding it, never destroying it) from there.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab !== 'chat') {
        setTab('chat');
        return true;
      }
      logEvent('back_button_exit');
      BackHandler.exitApp();
      return true;
    });
    return () => sub.remove();
  }, [tab]);

  const screen =
    tab === 'chat' ? (
      <ChatScreen onGoToModels={() => setTab('models')} />
    ) : tab === 'models' ? (
      <ModelsScreen onLoaded={() => setTab('chat')} />
    ) : (
      <SettingsScreen />
    );

  return (
    <View style={styles.root}>
      {/* The app draws its own background all the way to the edges, and
          each screen pads itself by the real insets rather than assuming a
          fixed status-bar height. */}
      <StatusBar barStyle="light-content" />

      {/* On a wide screen the chat stays open beside whatever else you're
          doing, so changing a setting doesn't hide the conversation. */}
      {layout.expanded && tab !== 'chat' ? (
        <View style={styles.split}>
          <View style={styles.splitMain}>{screen}</View>
          <View style={styles.splitAside}>
            <ChatScreen onGoToModels={() => setTab('models')} />
          </View>
        </View>
      ) : (
        <View style={styles.flex}>{screen}</View>
      )}

      <NavBar
        active={tab}
        onChange={setTab}
        ready={ready}
        horizontal={layout.landscape || !layout.compact}
      />
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <LlamaProvider>
          <Root />
        </LlamaProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  split: { flex: 1, flexDirection: 'row' },
  splitMain: { flex: 1.1 },
  splitAside: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: colors.borderSoft,
  },
});
