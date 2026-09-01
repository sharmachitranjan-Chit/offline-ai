import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { logEvent } from '../services/diagnostics';
import { colors, fontSizes, radius, spacing } from '../theme';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * A render-time error anywhere below this (a bad markdown parse, a
 * malformed model response, a layout crash) used to take the whole app
 * down with it. This catches that, logs exactly what broke, and offers a
 * way back in without losing the running model or the conversation.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logEvent('render_error', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.center}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The screen hit an error and had to stop. It's been recorded in
            the diagnostics log — check Settings if you want to see it. Your
            model and conversation are still intact.
          </Text>
          <Pressable
            style={styles.btn}
            onPress={() => this.setState({ error: null })}>
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  emoji: { fontSize: 38, marginBottom: spacing.md },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  body: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 420,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  btnText: { color: colors.onAccent, fontWeight: '700', fontSize: fontSizes.sm },
});
