/**
 * Offline AI — a local-first assistant.
 *
 * Everything happens on the device: text, image understanding, and reading
 * PDFs and office documents. The only network traffic is fetching a model
 * file, and even that is optional — you can supply your own.
 *
 * @format
 */

import React, { useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { LlamaProvider, useLlama } from './src/context/LlamaContext';
import ChatScreen from './src/screens/ChatScreen';
import ModelsScreen from './src/screens/ModelsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NavBar, { TabKey } from './src/components/NavBar';
import { colors, useLayout } from './src/theme';

function Root() {
  const [tab, setTab] = useState<TabKey>('chat');
  const { loadState } = useLlama();
  const layout = useLayout();

  const ready = loadState.status === 'ready';

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
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <LlamaProvider>
        <Root />
      </LlamaProvider>
    </SafeAreaProvider>
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
