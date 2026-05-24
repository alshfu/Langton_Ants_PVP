// src/state/defaultState.ts

import type { AppState, SandboxConfig } from '@core/contract/state';
import { PLAYER_PALETTE, GAME_LIMITS } from '@core/shared/constants';

export function defaultSandbox(): SandboxConfig {
  return {
    width: 80,
    height: 60,
    topology: 'torus',
    bgColor: '#0A081A',

    players: [
      { color: PLAYER_PALETTE[0]!.hex, antCount: 3, ruleId: 'classic', startHp: 3, spawnPattern: 'radial' },
      { color: PLAYER_PALETTE[1]!.hex, antCount: 3, ruleId: 'spiral',  startHp: 3, spawnPattern: 'radial' },
      { color: PLAYER_PALETTE[2]!.hex, antCount: 3, ruleId: 'flower',  startHp: 3, spawnPattern: 'radial' },
      { color: PLAYER_PALETTE[3]!.hex, antCount: 3, ruleId: 'reverse', startHp: 3, spawnPattern: 'radial' },
    ],

    birthEnabled: true,
    birthMinNeighbors: 3,
    birthCooldownTicks: 80,
    maxAntsPerPlayer: 12,
    hybridChance: 0.10,
    wildBirthChance: 0.03,

    hpEnabled: true,
    collisionCooldownTicks: GAME_LIMITS.COLLISION_COOLDOWN_TICKS,

    baseTps: 15,
    speedMultiplier: 1,

    showGrid: false,
    showGlow: true,
    showTrails: true,
    showHpDots: true,
    antScale: 0.9,

    seed: 42,
  };
}

export function defaultState(): AppState {
  return {
    currentScreen: 'menu',
    user: {
      id: 'local-user',
      username: 'You',
      colorId: 0,
      level: 1,
      sr: 1000,
    },
    locale: 'en',
    themeId: 'dark',
    sandbox: defaultSandbox(),
  };
}
