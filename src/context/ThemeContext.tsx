import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ImageStyle,
  StyleSheet,
  TextStyle,
  ViewStyle,
  useColorScheme,
} from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { Palette, darkPalette, lightPalette } from '../theme';
import { DocKit } from '../native/DocKit';

/**
 * Appearance.
 *
 * "System" is the default and the honest one: the phone already knows
 * whether the user wants light or dark, including on a schedule, and an app
 * that ignores that is a small daily annoyance. The explicit choices exist
 * because some people want a chat window dark at noon.
 *
 * The preference lives in its own tiny file rather than inside the main
 * settings blob. That keeps the provider independent of the model engine,
 * so the very first frame the app draws is already the right colour.
 */

export type ThemeMode = 'system' | 'light' | 'dark';

const APPEARANCE_PATH = `${RNFS.DocumentDirectoryPath}/appearance.json`;

type ThemeValue = {
  /** The palette to draw with, after resolving "system". */
  colors: Palette;
  dark: boolean;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
};

const Ctx = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    (async () => {
      try {
        if (await RNFS.exists(APPEARANCE_PATH)) {
          const saved = JSON.parse(await RNFS.readFile(APPEARANCE_PATH, 'utf8'));
          if (saved?.mode === 'light' || saved?.mode === 'dark' || saved?.mode === 'system') {
            setModeState(saved.mode);
          }
        }
      } catch {
        // A missing or corrupt preference just means "follow the system".
      }
    })();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    RNFS.writeFile(APPEARANCE_PATH, JSON.stringify({ mode: m }), 'utf8').catch(
      () => {},
    );
  }, []);

  const dark = mode === 'system' ? systemScheme !== 'light' : mode === 'dark';
  const colors = dark ? darkPalette : lightPalette;

  // The system bars are drawn by Android, not React, so they need telling
  // separately — otherwise light mode gets white icons on a white bar.
  useEffect(() => {
    DocKit.setSystemBars(dark ? '#0B0D11' : '#FBFAF9', dark);
  }, [dark]);

  const value = useMemo<ThemeValue>(
    () => ({ colors, dark, mode, setMode }),
    [colors, dark, mode, setMode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Rendering outside the provider shouldn't crash a screen; dark is the
    // historical default, so fall back to it.
    return {
      colors: darkPalette,
      dark: true,
      mode: 'system',
      setMode: () => {},
    };
  }
  return ctx;
}

/** Just the palette, which is what almost every component wants. */
export function useColors(): Palette {
  return useTheme().colors;
}

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Theme-aware StyleSheet.
 *
 * `const useStyles = makeStyles(c => ({ ... }))` at module scope, then
 * `const styles = useStyles()` inside the component. Each palette's sheet is
 * built once and cached, so switching themes costs one rebuild rather than
 * one per render — and the typing matches StyleSheet.create, so a typo in a
 * style key is still caught at compile time.
 */
export function makeStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  build: (colors: Palette) => T & NamedStyles<any>,
) {
  const cache = new Map<Palette, T>();
  return function useStyles(): T {
    const colors = useColors();
    let sheet = cache.get(colors);
    if (!sheet) {
      sheet = StyleSheet.create(build(colors));
      cache.set(colors, sheet);
    }
    return sheet;
  };
}
