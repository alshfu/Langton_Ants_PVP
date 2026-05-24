// src/state/AppStateProvider.tsx
//
// Главный контекст с AppState + сеттерами.
// В v1 используем useState, не reducer — состояние плоское и сетки полей мало.
// При росте сложности — переход на useReducer или zustand/jotai.

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { AppState, ScreenId, SandboxConfig } from '@core/contract/state';
import { defaultState } from './defaultState';

interface AppStateContextValue {
  state: AppState;
  setScreen: (id: ScreenId) => void;
  patchSandbox: (patch: Partial<SandboxConfig>) => void;
  resetSandbox: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => defaultState());

  const setScreen = useCallback((id: ScreenId) => {
    setState((s) => ({ ...s, currentScreen: id }));
  }, []);

  const patchSandbox = useCallback((patch: Partial<SandboxConfig>) => {
    setState((s) => ({ ...s, sandbox: { ...s.sandbox, ...patch } }));
  }, []);

  const resetSandbox = useCallback(() => {
    setState((s) => ({ ...s, sandbox: defaultState().sandbox }));
  }, []);

  const value = useMemo<AppStateContextValue>(
    () => ({ state, setScreen, patchSandbox, resetSandbox }),
    [state, setScreen, patchSandbox, resetSandbox],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>');
  return ctx;
}
