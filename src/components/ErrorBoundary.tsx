import React from 'react';
import { Appearance, Pressable, StyleSheet, Text, View } from 'react-native';
import { logEvent } from '../services/diagnostics';
import { darkPalette, fontSizes, lightPalette, radius, spacing } from '../theme';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * A render-time error anywhere below this (a bad markdown parse, a malformed
 * model response, a layout crash) used to take the whole app down. This
 * catches it, logs what broke, and offers a way back in.
 *
 * It sits above the ThemeProvider (so it still works if that is what threw),
 * which is why it reads the system scheme directly instead of useTheme().
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
    if (!this.state.error) return this.props.children;
    const c = Appearance.getColorScheme() === 'light' ? lightPalette : darkPalette;
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={[styles.title, { color: c.textPrimary }]}>Something went wrong</Text>
        <Text style={[styles.body, { color: c.textSecondary }]}>
          The screen hit an error and had to stop. It has been recorded in the
          diagnostics log in Settings. Your model files and chats are intact.
        </Text>
        <Text style={[styles.detail, { color: c.textFaint }]} numberOfLines={4}>
          {this.state.error.message}
        </Text>
        <Pressable
          style={[styles.btn, { backgroundColor: c.accent }]}
          onPress={() => this.setState({ error: null })}>
          <Text style={[styles.btnText, { color: c.onAccent }]}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  body: {
    fontSize: fontSizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 420,
  },
  detail: {
    fontSize: fontSizes.xxs,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: 420,
  },
  btn: {
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  btnText: { fontWeight: '700', fontSize: fontSizes.sm },
});
