/**
 * Offline AI — a small React Native app for chatting with free,
 * open-weight LLMs entirely on-device via llama.cpp (through llama.rn).
 *
 * @format
 */

import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, StyleSheet, View } from 'react-native';
import { LlamaProvider, useLlama } from './src/context/LlamaContext';
import ChatScreen from './src/screens/ChatScreen';
import ModelsScreen from './src/screens/ModelsScreen';
import TabBar, { TabKey } from './src/components/TabBar';
import { colors } from './src/theme';

function Root() {
  const [tab, setTab] = useState<TabKey>('chat');
  const { loadState } = useLlama();

  return (
    <View style={styles.flex}>
      <StatusBar barStyle="light-content" />
      <View style={styles.flex}>
        {tab === 'chat' ? (
          <ChatScreen onGoToModels={() => setTab('models')} />
        ) : (
          <ModelsScreen />
        )}
      </View>
      <TabBar
        active={tab}
        onChange={setTab}
        modelBadge={loadState.status === 'ready' ? '✓' : undefined}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LlamaProvider>
        <Root />
      </LlamaProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
