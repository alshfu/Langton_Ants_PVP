// core/src/lib/buildEngineState.test.ts
//
// Stage 8 Day 8 — shared engine state builders.

import { describe, it, expect } from 'vitest';
import { buildAntsFromConfig, buildBirthConfig } from './buildEngineState';
import type { SandboxConfig } from '../contract/state';

function minConfig(overrides: Partial<SandboxConfig> = {}): SandboxConfig {
  return {
    width: 30,
    height: 30,
    topology: 'torus',
    bgColor: '#000',
    showGrid: false,
    players: [
      {
        id: 'p0', name: 'P1', color: '#FF5470', ruleId: 'classic',
        startHp: 3, spawnPattern: 'manual', antCount: 1,
        ants: [{ id: 'p0_a0', x: 5, y: 5, dir: 0, ruleOverride: null }],
      },
    ],
    hpEnabled: true, damageCapEnabled: true, collisionCooldownTicks: 5,
    birthEnabled: false, birthMinNeighbors: 3, birthCooldownTicks: 20,
    maxAntsPerPlayer: 10, unlimitedAnts: false,
    hybridChance: 0, wildBirthChance: 0,
    showGlow: false, showTrails: false, showHpDots: false,
    showDirectionArrows: false, showCellState: false,
    skinPack: 'shape', heatmapMode: 'off', heatmapOpacity: 0.5,
    antScale: 1, trailDecay: 0.96,
    baseTps: 10, speedMultiplier: 1, seed: 1,
    mutation: {
      enabled: false,
      haloEnabled: false, haloMinNeighbors: 6,
      mirrorEnabled: false, mirrorRadius: 2,
      pathEnabled: false, pathStraightTicks: 10,
    },
    winCondition: { kind: 'none', threshold: 0 },
    reserveMode: false, deployRule: 'anywhere', deployRadius: 3,
    ...overrides,
  };
}

describe('buildAntsFromConfig', () => {
  it('создаёт Ant[] из players[].ants', () => {
    const cfg = minConfig();
    const ants = buildAntsFromConfig(cfg);
    expect(ants).toHaveLength(1);
    expect(ants[0]!.id).toBe('p0_a0');
    expect(ants[0]!.owner).toBe(0);
    expect(ants[0]!.x).toBe(5);
    expect(ants[0]!.y).toBe(5);
    expect(ants[0]!.rule).toBe('RL'); // classic
    expect(ants[0]!.hp).toBe(3);
    expect(ants[0]!.maxHp).toBe(3);
  });

  it('ruleOverride переопределяет player rule', () => {
    const cfg = minConfig({
      players: [{
        id: 'p0', name: 'P1', color: '#FF5470', ruleId: 'classic',
        startHp: 3, spawnPattern: 'manual', antCount: 1,
        ants: [{ id: 'p0_a0', x: 0, y: 0, dir: 0, ruleOverride: 'spiral' }],
      }],
    });
    const ants = buildAntsFromConfig(cfg);
    expect(ants[0]!.rule).toBe('LRR'); // spiral
  });

  it('owner indexes от 0', () => {
    const cfg = minConfig({
      players: [
        {
          id: 'p0', name: 'P1', color: '#FF5470', ruleId: 'classic',
          startHp: 3, spawnPattern: 'manual', antCount: 1,
          ants: [{ id: 'p0_a0', x: 0, y: 0, dir: 0, ruleOverride: null }],
        },
        {
          id: 'p1', name: 'P2', color: '#4DA8FF', ruleId: 'classic',
          startHp: 3, spawnPattern: 'manual', antCount: 1,
          ants: [{ id: 'p1_a0', x: 10, y: 10, dir: 0, ruleOverride: null }],
        },
      ],
    });
    const ants = buildAntsFromConfig(cfg);
    expect(ants[0]!.owner).toBe(0);
    expect(ants[1]!.owner).toBe(1);
  });
});

describe('buildBirthConfig', () => {
  it('return null если birthEnabled=false', () => {
    expect(buildBirthConfig(minConfig({ birthEnabled: false }))).toBeNull();
  });

  it('return BirthConfig если birthEnabled=true', () => {
    const cfg = minConfig({ birthEnabled: true });
    const bc = buildBirthConfig(cfg)!;
    expect(bc.enabled).toBe(true);
    expect(bc.minNeighbors).toBe(3);
    expect(bc.maxAntsPerPlayer).toBe(10);
  });

  it('mutation enabled → mutation объект в BirthConfig', () => {
    const cfg = minConfig({
      birthEnabled: true,
      mutation: {
        enabled: true,
        haloEnabled: true, haloMinNeighbors: 6,
        mirrorEnabled: false, mirrorRadius: 2,
        pathEnabled: false, pathStraightTicks: 10,
      },
    });
    const bc = buildBirthConfig(cfg)!;
    expect(bc.mutation).toBeDefined();
    expect(bc.mutation!.haloEnabled).toBe(true);
  });

  it('mutation disabled → mutation undefined в BirthConfig', () => {
    const cfg = minConfig({ birthEnabled: true });
    const bc = buildBirthConfig(cfg)!;
    expect(bc.mutation).toBeUndefined();
  });
});
