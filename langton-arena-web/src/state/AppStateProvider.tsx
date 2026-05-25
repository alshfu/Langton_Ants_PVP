// src/state/AppStateProvider.tsx
//
// Главный контекст с AppState + полным набором actions для Sandbox v2.

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import type {
  AppState, ScreenId,
  SandboxConfig, SandboxAntConfig, SandboxPlayerConfig,
  SandboxMode, UserPreset,
} from '@core/contract/state';
import { defaultState, defaultRuntimeState } from './defaultState';
import { generateAnts, clampAntsToField } from '@lib/spawnPatterns';
import { load, save, debounceSave } from '@lib/storage';
import { PLAYER_PALETTE } from '@core/shared/constants';

interface SandboxActions {
  patchSandbox: (patch: Partial<SandboxConfig>) => void;
  resetSandbox: () => void;
  reseed: () => void;
  resetWithSameSeed: () => void;

  addPlayer: () => void;
  removePlayer: (playerId: string) => void;
  patchPlayer: (playerId: string, patch: Partial<SandboxPlayerConfig>) => void;
  respawnAntsForPlayer: (playerId: string) => void;

  addAnt: (playerId: string, ant: Omit<SandboxAntConfig, 'id'>) => void;
  removeAnt: (antId: string) => void;
  patchAnt: (antId: string, patch: Partial<SandboxAntConfig>) => void;

  setMode: (mode: SandboxMode) => void;
  setPaused: (paused: boolean) => void;
  setActivePlayer: (playerId: string | null) => void;
  setSelectedAnt: (antId: string | null) => void;

  loadPreset: (config: SandboxConfig) => void;
  saveUserPreset: (name: string) => { ok: boolean; reason?: string };
  deleteUserPreset: (id: string) => void;
}

interface AppStateContextValue {
  state: AppState;
  setScreen: (id: ScreenId) => void;
  sandbox: SandboxActions;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

const STORAGE_KEY_LAST_CONFIG = 'sandbox.lastConfig';
const STORAGE_KEY_USER_PRESETS = 'sandbox.userPresets';
const USER_PRESETS_MAX = 10;

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    const base = defaultState();
    const savedConfig = load<SandboxConfig>(STORAGE_KEY_LAST_CONFIG);
    const savedPresets = load<UserPreset[]>(STORAGE_KEY_USER_PRESETS);
    if (savedConfig) base.sandbox = mergeWithDefaults(savedConfig, base.sandbox);
    if (savedPresets && Array.isArray(savedPresets)) base.userPresets = savedPresets;
    base.sandboxRuntime = defaultRuntimeState(base.sandbox.players[0]?.id ?? null);
    return base;
  });

  const persistConfig = useMemo(() => debounceSave<SandboxConfig>(STORAGE_KEY_LAST_CONFIG, 500), []);
  useEffect(() => { persistConfig(state.sandbox); }, [state.sandbox, persistConfig]);
  useEffect(() => { save(STORAGE_KEY_USER_PRESETS, state.userPresets); }, [state.userPresets]);

  const setScreen = useCallback((id: ScreenId) => {
    setState((s) => ({ ...s, currentScreen: id }));
  }, []);

  const patchSandbox = useCallback((patch: Partial<SandboxConfig>) => {
    setState((s) => {
      const nextSandbox = { ...s.sandbox, ...patch };
      if (patch.width !== undefined || patch.height !== undefined) {
        nextSandbox.players = nextSandbox.players.map((p) => {
          const { ants } = clampAntsToField(p.ants, nextSandbox.width, nextSandbox.height);
          return { ...p, ants };
        });
      }
      return { ...s, sandbox: nextSandbox };
    });
  }, []);

  const resetSandbox = useCallback(() => {
    setState((s) => {
      const fresh = defaultState();
      return {
        ...s,
        sandbox: fresh.sandbox,
        sandboxRuntime: defaultRuntimeState(fresh.sandbox.players[0]?.id ?? null),
      };
    });
  }, []);

  const reseed = useCallback(() => {
    setState((s) => {
      const newSeed = Math.floor(Math.random() * 100000);
      const players = s.sandbox.players.map((p, i) => ({
        ...p,
        ants: p.spawnPattern === 'manual' ? p.ants : generateAnts(p.spawnPattern, {
          playerIndex: i,
          totalPlayers: s.sandbox.players.length,
          fieldW: s.sandbox.width,
          fieldH: s.sandbox.height,
          antCount: p.antCount,
          seed: newSeed,
        }),
      }));
      return {
        ...s,
        sandbox: { ...s.sandbox, seed: newSeed, players },
        sandboxRuntime: { ...s.sandboxRuntime, liveStats: { ...s.sandboxRuntime.liveStats, tick: 0 } },
      };
    });
  }, []);

  const resetWithSameSeed = useCallback(() => {
    setState((s) => ({
      ...s,
      sandboxRuntime: { ...s.sandboxRuntime, liveStats: { ...s.sandboxRuntime.liveStats, tick: 0 } },
    }));
  }, []);

  const addPlayer = useCallback(() => {
    setState((s) => {
      if (s.sandbox.players.length >= 10) return s;
      const idx = s.sandbox.players.length;
      const palette = PLAYER_PALETTE[idx % PLAYER_PALETTE.length]!;
      const newPlayer: SandboxPlayerConfig = {
        id: `player_${Date.now()}`,
        name: `P${idx + 1}`,
        color: palette.hex,
        ruleId: 'classic',
        startHp: 3,
        spawnPattern: 'radial',
        antCount: 3,
        ants: [],
      };
      newPlayer.ants = generateAnts('radial', {
        playerIndex: idx,
        totalPlayers: s.sandbox.players.length + 1,
        fieldW: s.sandbox.width,
        fieldH: s.sandbox.height,
        antCount: newPlayer.antCount,
        seed: s.sandbox.seed,
      });
      return { ...s, sandbox: { ...s.sandbox, players: [...s.sandbox.players, newPlayer] } };
    });
  }, []);

  const removePlayer = useCallback((playerId: string) => {
    setState((s) => {
      if (s.sandbox.players.length <= 2) return s;
      const players = s.sandbox.players.filter((p) => p.id !== playerId);
      const runtime = { ...s.sandboxRuntime };
      if (runtime.activePlayerId === playerId) runtime.activePlayerId = players[0]?.id ?? null;
      return { ...s, sandbox: { ...s.sandbox, players }, sandboxRuntime: runtime };
    });
  }, []);

  const patchPlayer = useCallback((playerId: string, patch: Partial<SandboxPlayerConfig>) => {
    setState((s) => ({
      ...s,
      sandbox: {
        ...s.sandbox,
        players: s.sandbox.players.map((p) => p.id === playerId ? { ...p, ...patch } : p),
      },
    }));
  }, []);

  const respawnAntsForPlayer = useCallback((playerId: string) => {
    setState((s) => {
      const pIdx = s.sandbox.players.findIndex((p) => p.id === playerId);
      if (pIdx < 0) return s;
      const player = s.sandbox.players[pIdx]!;
      if (player.spawnPattern === 'manual') return s;
      const newAnts = generateAnts(player.spawnPattern, {
        playerIndex: pIdx,
        totalPlayers: s.sandbox.players.length,
        fieldW: s.sandbox.width,
        fieldH: s.sandbox.height,
        antCount: player.antCount,
        seed: s.sandbox.seed,
      });
      const players = [...s.sandbox.players];
      players[pIdx] = { ...player, ants: newAnts };
      return { ...s, sandbox: { ...s.sandbox, players } };
    });
  }, []);

  const addAnt = useCallback((playerId: string, ant: Omit<SandboxAntConfig, 'id'>) => {
    setState((s) => {
      const pIdx = s.sandbox.players.findIndex((p) => p.id === playerId);
      if (pIdx < 0) return s;
      const player = s.sandbox.players[pIdx]!;
      const newAnt: SandboxAntConfig = {
        ...ant,
        id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      };
      const players = [...s.sandbox.players];
      players[pIdx] = {
        ...player,
        spawnPattern: 'manual',
        ants: [...player.ants, newAnt],
      };
      return { ...s, sandbox: { ...s.sandbox, players } };
    });
  }, []);

  const removeAnt = useCallback((antId: string) => {
    setState((s) => ({
      ...s,
      sandbox: {
        ...s.sandbox,
        players: s.sandbox.players.map((p) => ({
          ...p,
          ants: p.ants.filter((a) => a.id !== antId),
        })),
      },
      sandboxRuntime: {
        ...s.sandboxRuntime,
        selectedAntId: s.sandboxRuntime.selectedAntId === antId ? null : s.sandboxRuntime.selectedAntId,
      },
    }));
  }, []);

  const patchAnt = useCallback((antId: string, patch: Partial<SandboxAntConfig>) => {
    setState((s) => ({
      ...s,
      sandbox: {
        ...s.sandbox,
        players: s.sandbox.players.map((p) => ({
          ...p,
          ants: p.ants.map((a) => a.id === antId ? { ...a, ...patch } : a),
        })),
      },
    }));
  }, []);

  const setMode = useCallback((mode: SandboxMode) => {
    setState((s) => ({
      ...s,
      sandboxRuntime: {
        ...s.sandboxRuntime,
        mode,
        paused: mode === 'edit' ? true : s.sandboxRuntime.paused,
      },
    }));
  }, []);

  const setPaused = useCallback((paused: boolean) => {
    setState((s) => ({ ...s, sandboxRuntime: { ...s.sandboxRuntime, paused } }));
  }, []);

  const setActivePlayer = useCallback((playerId: string | null) => {
    setState((s) => ({ ...s, sandboxRuntime: { ...s.sandboxRuntime, activePlayerId: playerId } }));
  }, []);

  const setSelectedAnt = useCallback((antId: string | null) => {
    setState((s) => ({ ...s, sandboxRuntime: { ...s.sandboxRuntime, selectedAntId: antId } }));
  }, []);

  const loadPreset = useCallback((config: SandboxConfig) => {
    setState((s) => ({
      ...s,
      sandbox: structuredClone(config),
      sandboxRuntime: defaultRuntimeState(config.players[0]?.id ?? null),
    }));
  }, []);

  const saveUserPreset = useCallback((name: string): { ok: boolean; reason?: string } => {
    let result: { ok: boolean; reason?: string } = { ok: true };
    setState((s) => {
      if (s.userPresets.length >= USER_PRESETS_MAX) {
        result = { ok: false, reason: `Limit ${USER_PRESETS_MAX} reached, delete one first` };
        return s;
      }
      const preset: UserPreset = {
        id: `user_${Date.now()}`,
        name: name.slice(0, 40) || `Preset ${s.userPresets.length + 1}`,
        createdAt: Date.now(),
        config: structuredClone(s.sandbox),
      };
      return { ...s, userPresets: [...s.userPresets, preset] };
    });
    return result;
  }, []);

  const deleteUserPreset = useCallback((id: string) => {
    setState((s) => ({ ...s, userPresets: s.userPresets.filter((p) => p.id !== id) }));
  }, []);

  const sandbox = useMemo<SandboxActions>(() => ({
    patchSandbox, resetSandbox, reseed, resetWithSameSeed,
    addPlayer, removePlayer, patchPlayer, respawnAntsForPlayer,
    addAnt, removeAnt, patchAnt,
    setMode, setPaused, setActivePlayer, setSelectedAnt,
    loadPreset, saveUserPreset, deleteUserPreset,
  }), [
    patchSandbox, resetSandbox, reseed, resetWithSameSeed,
    addPlayer, removePlayer, patchPlayer, respawnAntsForPlayer,
    addAnt, removeAnt, patchAnt,
    setMode, setPaused, setActivePlayer, setSelectedAnt,
    loadPreset, saveUserPreset, deleteUserPreset,
  ]);

  const value = useMemo<AppStateContextValue>(
    () => ({ state, setScreen, sandbox }),
    [state, setScreen, sandbox],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>');
  return ctx;
}

function mergeWithDefaults(saved: Partial<SandboxConfig>, defaults: SandboxConfig): SandboxConfig {
  return { ...defaults, ...saved, players: saved.players ?? defaults.players };
}
