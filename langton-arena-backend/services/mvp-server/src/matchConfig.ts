// src/matchConfig.ts
//
// Дефолтный SandboxConfig для PvP MVP матча.
// Источник: spec §14 Q2 ответ A — 60×60, 2 игрока × 3 муравья, halo mutation,
// time win 300 ticks.
//
// Stage 8 Day 4: фиксированный конфиг. Stage 9+ — host выбирает в lobby.

import type { SandboxConfig } from '@langton/core';

/**
 * Build default 2-player match config.
 * Player A — top-left corner (rule classic, 3 ants).
 * Player B — bottom-right corner.
 * Halo mutation enabled. Time-based win at tick 300.
 */
export function defaultMatchConfig(seed: number): SandboxConfig {
  return {
    width: 60,
    height: 60,
    topology: 'torus',
    bgColor: '#0A081A',
    showGrid: false,
    players: [
      {
        id: 'p0',
        name: 'P1',
        color: '#FF5470',
        ruleId: 'classic',
        startHp: 3,
        spawnPattern: 'corner',
        antCount: 3,
        ants: [
          { id: 'p0_a0', x: 5, y: 5, dir: 1, ruleOverride: null },
          { id: 'p0_a1', x: 6, y: 6, dir: 1, ruleOverride: null },
          { id: 'p0_a2', x: 7, y: 7, dir: 1, ruleOverride: null },
        ],
      },
      {
        id: 'p1',
        name: 'P2',
        color: '#4DA8FF',
        ruleId: 'classic',
        startHp: 3,
        spawnPattern: 'corner',
        antCount: 3,
        ants: [
          { id: 'p1_a0', x: 54, y: 54, dir: 3, ruleOverride: null },
          { id: 'p1_a1', x: 53, y: 53, dir: 3, ruleOverride: null },
          { id: 'p1_a2', x: 52, y: 52, dir: 3, ruleOverride: null },
        ],
      },
    ],
    hpEnabled: true,
    damageCapEnabled: true,
    collisionCooldownTicks: 5,
    birthEnabled: true,
    birthMinNeighbors: 3,
    birthCooldownTicks: 50,
    maxAntsPerPlayer: 20,
    unlimitedAnts: false,
    hybridChance: 0,
    wildBirthChance: 0,
    showGlow: true,
    showTrails: true,
    showHpDots: false,
    showDirectionArrows: false,
    showCellState: false,
    skinPack: 'shape',
    heatmapMode: 'off',
    heatmapOpacity: 0.55,
    antScale: 1.0,
    trailDecay: 0.96,
    baseTps: 10,
    speedMultiplier: 1,
    seed,
    mutation: {
      enabled: true,
      haloEnabled: true,
      haloMinNeighbors: 6,
      mirrorEnabled: false,
      mirrorRadius: 2,
      pathEnabled: false,
      pathStraightTicks: 10,
    },
    winCondition: { kind: 'time', threshold: 300 },
    reserveMode: false,
    deployRule: 'anywhere',
    deployRadius: 3,
  };
}

/** PvP лимит: spec §3.4 — server не вытянет > 200×200 в realtime. */
export const PVP_MAX_FIELD = 200;

/** Engine semver — server reports клиенту в match_started. */
export const SERVER_ENGINE_VERSION = '0.1.0';
