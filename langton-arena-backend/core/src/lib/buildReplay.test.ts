// core/src/lib/buildReplay.test.ts

import { describe, it, expect } from 'vitest';
import { buildReplayFromMatch } from './buildReplay';
import { REPLAY_FORMAT_VERSION } from '../contract/replay';
import type { SandboxConfig } from '../contract/state';
import type { DeployAction } from '../contract/replay';

function minCfg(): SandboxConfig {
  return {
    width: 30, height: 30,
    topology: 'torus', bgColor: '#000', showGrid: false,
    players: [
      { id: 'p0', name: 'A', color: '#f00', ruleId: 'classic', startHp: 3,
        spawnPattern: 'manual', antCount: 1,
        ants: [{ id: 'p0_a0', x: 5, y: 5, dir: 0, ruleOverride: null }] },
    ],
    hpEnabled: true, damageCapEnabled: true, collisionCooldownTicks: 5,
    birthEnabled: false, birthMinNeighbors: 3, birthCooldownTicks: 20,
    maxAntsPerPlayer: 10, unlimitedAnts: false,
    hybridChance: 0, wildBirthChance: 0,
    showGlow: false, showTrails: false, showHpDots: false,
    showDirectionArrows: false, showCellState: false,
    skinPack: 'shape', heatmapMode: 'off', heatmapOpacity: 0.5,
    antScale: 1, trailDecay: 0.96,
    baseTps: 10, speedMultiplier: 1, seed: 42,
    mutation: { enabled: false, haloEnabled: false, haloMinNeighbors: 6,
      mirrorEnabled: false, mirrorRadius: 2,
      pathEnabled: false, pathStraightTicks: 10 },
    winCondition: { kind: 'time', threshold: 100 },
    reserveMode: false, deployRule: 'anywhere', deployRadius: 3,
  };
}

describe('buildReplayFromMatch', () => {
  it('базовая структура: version + metadata + config + deployTimeline', () => {
    const cfg = minCfg();
    const timeline: DeployAction[] = [
      { tick: 5, playerIdx: 0, x: 1, y: 1 },
      { tick: 8, playerIdx: 1, x: 2, y: 2 },
    ];
    const replay = buildReplayFromMatch({
      matchId: 'match-abc-123',
      config: cfg,
      deployTimeline: timeline,
      finishedAtTick: 100,
    });
    expect(replay.version).toBe(REPLAY_FORMAT_VERSION);
    expect(replay.config).toBe(cfg); // not deep cloned — config immutable
    expect(replay.metadata.id).toBe('pvp-match-abc-123');
    expect(replay.metadata.durationTicks).toBe(100);
    expect(replay.metadata.deployCount).toBe(2);
    expect(replay.deployTimeline).toHaveLength(2);
    expect(replay.deployTimeline[0]).toEqual({ tick: 5, playerIdx: 0, x: 1, y: 1 });
  });

  it('deployTimeline защитная копия — не shared reference', () => {
    const timeline: DeployAction[] = [{ tick: 1, playerIdx: 0, x: 1, y: 1 }];
    const replay = buildReplayFromMatch({
      matchId: 'm', config: minCfg(),
      deployTimeline: timeline, finishedAtTick: 10,
    });
    expect(replay.deployTimeline).not.toBe(timeline);
    expect(replay.deployTimeline).toEqual(timeline);
  });

  it('default name использует matchId prefix', () => {
    const replay = buildReplayFromMatch({
      matchId: 'match-very-long-id-xxxxxx',
      config: minCfg(), deployTimeline: [], finishedAtTick: 10,
    });
    expect(replay.metadata.name).toContain('PvP');
    expect(replay.metadata.name).toContain('match-very-l');
  });

  it('explicit name переопределяет default', () => {
    const replay = buildReplayFromMatch({
      matchId: 'm', config: minCfg(), deployTimeline: [], finishedAtTick: 10,
      name: 'Epic battle of doom',
    });
    expect(replay.metadata.name).toBe('Epic battle of doom');
  });

  it('createdAt default = now', () => {
    const before = Date.now();
    const replay = buildReplayFromMatch({
      matchId: 'm', config: minCfg(), deployTimeline: [], finishedAtTick: 10,
    });
    expect(replay.metadata.createdAt).toBeGreaterThanOrEqual(before);
    expect(replay.metadata.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it('explicit createdAt преобладает', () => {
    const replay = buildReplayFromMatch({
      matchId: 'm', config: minCfg(), deployTimeline: [], finishedAtTick: 10,
      createdAt: 1_700_000_000_000,
    });
    expect(replay.metadata.createdAt).toBe(1_700_000_000_000);
  });

  it('presetName опционально включается в metadata', () => {
    const replay = buildReplayFromMatch({
      matchId: 'm', config: minCfg(), deployTimeline: [], finishedAtTick: 10,
      presetName: 'Defense Stand',
    });
    expect(replay.metadata.presetName).toBe('Defense Stand');
  });

  it('пустой deployTimeline → deployCount=0', () => {
    const replay = buildReplayFromMatch({
      matchId: 'm', config: minCfg(), deployTimeline: [], finishedAtTick: 50,
    });
    expect(replay.metadata.deployCount).toBe(0);
    expect(replay.deployTimeline).toHaveLength(0);
  });
});
