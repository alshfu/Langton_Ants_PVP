// src/theme/ThemeProvider.tsx
//
// Контекст-провайдер для текущей темы.
// Использование:
//   <ThemeProvider initial="dark">
//     <App />
//   </ThemeProvider>
//
//   const { tokens, setTheme } = useTheme();
//   <div style={{ background: tokens.bg }}>...</div>

import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { THEME_TOKENS, type ThemeId, type ThemeTokens } from './tokens';

interface ThemeContextValue {
  themeId: ThemeId;
  tokens: ThemeTokens;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  initial = 'dark',
  children,
}: {
  initial?: ThemeId;
  children: React.ReactNode;
}) {
  const [themeId, setThemeId] = useState<ThemeId>(initial);
  const setTheme = useCallback((id: ThemeId) => setThemeId(id), []);

  const value = useMemo<ThemeContextValue>(() => ({
    themeId,
    tokens: THEME_TOKENS[themeId] ?? THEME_TOKENS.dark!,
    setTheme,
  }), [themeId, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
