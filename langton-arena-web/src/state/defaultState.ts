// src/state/defaultState.ts

import type { AppState, SandboxConfig, SandboxRuntimeState, SandboxPlayerConfig } from '@core/contract/state';
import { PLAYER_PALETTE, GAME_LIMITS } from '@core/shared/constants';
import { generateAnts } from '@lib/spawnPatterns';

function defaultPlayer(idx: number, ruleId: string): SandboxPlayerConfig {
  const palette = PLAYER_PALETTE[idx % PLAYER_PALETTE.length]!;
  return {
    id: `player_${idx}`,
    name: `P${idx + 1}`,
    color: palette.hex,
    ruleId,
    startHp: 3,
    spawnPattern: 'radial',
    antCount: 3,
    ants: [],
  };
}

export function defaultSandbox(): SandboxConfig {
  const W = 80, H = 60, seed = 42;

  const players: SandboxPlayerConfig[] = [
    defaultPlayer(0, 'classic'),
    defaultPlayer(1, 'spiral'),
    defaultPlayer(2, 'flower'),
    defaultPlayer(3, 'reverse'),
  ];

  // Auto-populate ants по spawnPattern каждого игрока
  players.forEach((p, i) => {
    p.ants = generateAnts(p.spawnPattern, {
      playerIndex: i,
      totalPlayers: players.length,
      fieldW: W,
      fieldH: H,
      antCount: p.antCount,
      seed,
    });
  });

  return {
    width: W, height: H,
    topology: 'torus',
    bgColor: '#0A081A',
    showGrid: false,

    players,

    hpEnabled: true,
    damageCapEnabled: true,
    collisionCooldownTicks: GAME_LIMITS.COLLISION_COOLDOWN_TICKS,

    birthEnabled: true,
    birthMinNeighbors: 3,
    birthCooldownTicks: 80,
    maxAntsPerPlayer: 12,
    hybridChance: 0.10,
    wildBirthChance: 0.03,
    unlimitedAnts: false,

    showGlow: true,
    showTrails: true,
    showHpDots: true,
    showDirectionArrows: false,
    showCellState: false,
    skinPack: 'shape',
    heatmapMode: 'off',
    heatmapOpacity: 0.55,
    antScale: 0.9,
    trailDecay: 0.94,

    baseTps: 15,
    speedMultiplier: 1,
    seed,

    // Stage 5 defaults
    mutation: {
      enabled: false,
      haloEnabled: false,
      haloMinNeighbors: 6,
      mirrorEnabled: false,
      mirrorRadius: 2,
      pathEnabled: false,
      pathStraightTicks: 10,
    },
    winCondition: {
      kind: 'none',
      threshold: 5,
    },

    // Stage 6 defaults
    reserveMode: false,        // backward compat — старые пресеты работают как раньше
    deployRule: 'anywhere',
    deployRadius: 3,
  };
}

export function defaultRuntimeState(activePlayerId: string | null): SandboxRuntimeState {
  return {
    mode: 'edit',
    paused: true,
    activePlayerId,
    selectedAntId: null,
    deployMode: false,         // Stage 6
    activeReplayId: null,      // Stage 7
    activeReplayName: null,    // Stage 7
    liveStats: {
      tick: 0,
      perPlayer: {},
      territoryHistory: [],
      totals: { births: 0, deaths: 0, captures: 0, clashes: 0, hybrids: 0, wilds: 0, mutants: 0 },
      events: [],
      highlights: [],
      match: {
        finished: false,
        winnerId: null,
        winnerName: null,
        reason: '',
        finishedAtTick: 0,
        bannerVisible: false,
      },
    },
  };
}

export function defaultState(): AppState {
  const sandbox = defaultSandbox();
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
    sandbox,
    sandboxRuntime: defaultRuntimeState(sandbox.players[0]?.id ?? null),
    userPresets: [],
  };
}
