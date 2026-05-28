// core/src/lib/applyDeploy.test.ts
//
// Stage 8 Day 9 — shared deploy apply helper.
// Гарантирует bit-identical ant creation между server и client.

import { describe, it, expect } from 'vitest';
import { applyDeployAction } from './applyDeploy';
import { makeLangtonState } from '../langton/engine';
import type { SandboxConfig } from '../contract/state';
import type { DeployAction } from '../contract/replay';
import type { SimState } from '../langton/engine';

function cfg(): SandboxConfig {
  return {
    width: 30, height: 30,
    topology: 'torus', bgColor: '#000', showGrid: false,
    players: [
      { id: 'p0', name: 'A', color: '#f00', ruleId: 'classic', startHp: 5,
        spawnPattern: 'manual', antCount: 0, ants: [] },
      { id: 'p1', name: 'B', color: '#00f', ruleId: 'spiral', startHp: 7,
        spawnPattern: 'manual', antCount: 0, ants: [] },
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
    mutation: { enabled: false, haloEnabled: false, haloMinNeighbors: 6,
      mirrorEnabled: false, mirrorRadius: 2,
      pathEnabled: false, pathStraightTicks: 10 },
    winCondition: { kind: 'none', threshold: 0 },
    reserveMode: false, deployRule: 'anywhere', deployRadius: 3,
  };
}

function emptySim(c: SandboxConfig): SimState {
  return makeLangtonState({
    w: c.width, h: c.height, ants: [], seed: c.seed,
    collisionCooldownTicks: c.collisionCooldownTicks,
    hpEnabled: c.hpEnabled, damageCapEnabled: c.damageCapEnabled,
    birthConfig: null, topology: 'torus',
  });
}

describe('applyDeployAction', () => {
  it('пушит ant с координатами из action', () => {
    const c = cfg();
    const sim = emptySim(c);
    const action: DeployAction = { tick: 0, playerIdx: 0, x: 7, y: 11 };
    const ok = applyDeployAction(sim, action, c);
    expect(ok).toBe(true);
    expect(sim.ants).toHaveLength(1);
    expect(sim.ants[0]!.x).toBe(7);
    expect(sim.ants[0]!.y).toBe(11);
    expect(sim.ants[0]!.owner).toBe(0);
  });

  it('берёт rule из player.ruleId', () => {
    const c = cfg();
    const sim = emptySim(c);
    applyDeployAction(sim, { tick: 0, playerIdx: 1, x: 1, y: 1 }, c);
    expect(sim.ants[0]!.rule).toBe('LRR');
  });

  it('hp/maxHp = player.startHp', () => {
    const c = cfg();
    const sim = emptySim(c);
    applyDeployAction(sim, { tick: 0, playerIdx: 1, x: 2, y: 2 }, c);
    expect(sim.ants[0]!.hp).toBe(7);
    expect(sim.ants[0]!.maxHp).toBe(7);
  });

  it('bornAt = sim.tick на момент apply', () => {
    const c = cfg();
    const sim = emptySim(c);
    sim.tick = 42;
    applyDeployAction(sim, { tick: 42, playerIdx: 0, x: 1, y: 2 }, c);
    expect(sim.ants[0]!.bornAt).toBe(42);
  });

  it('returns false если playerIdx out of range', () => {
    const c = cfg();
    const sim = emptySim(c);
    const ok = applyDeployAction(sim, { tick: 0, playerIdx: 99, x: 0, y: 0 }, c);
    expect(ok).toBe(false);
    expect(sim.ants).toHaveLength(0);
  });

  it('детерминирован: одинаковый action → одинаковый ant', () => {
    const c = cfg();
    const simA = emptySim(c);
    const simB = emptySim(c);
    const action: DeployAction = { tick: 5, playerIdx: 0, x: 3, y: 4 };
    simA.tick = 5; simB.tick = 5;
    applyDeployAction(simA, action, c);
    applyDeployAction(simB, action, c);
    expect(simA.ants[0]).toEqual(simB.ants[0]);
  });

  it('два deploy в один тик → два ant с разными ID (если разные координаты)', () => {
    const c = cfg();
    const sim = emptySim(c);
    applyDeployAction(sim, { tick: 0, playerIdx: 0, x: 1, y: 1 }, c);
    applyDeployAction(sim, { tick: 0, playerIdx: 0, x: 2, y: 2 }, c);
    expect(sim.ants).toHaveLength(2);
    expect(sim.ants[0]!.id).not.toBe(sim.ants[1]!.id);
  });
});
