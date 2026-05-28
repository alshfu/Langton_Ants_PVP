// src/match.ts
//
// Match — активный матч в Room. Stage 8 Day 4.
// Lifecycle:
//   countdown (3000ms) → match_started → tick loop @ 10 TPS → match_ended
//
// Day 4: deploys timeline пустой (Day 5 implements). Win condition — time-based
// (tick >= config.winCondition.threshold), result = tie (winnerId null).
//
// Day 11+ - full computeMatchResult с perPlayer stats для domination/elimination.

import {
  makeLangtonState,
  stepLangton,
  LA_RULES,
  type SimState,
  type Ant,
  type BirthConfig,
  type SandboxConfig,
  type MatchResult,
} from '@langton/core';
import type { Room } from './room.js';
import type { DeployAction } from './messages.js';
import { SERVER_ENGINE_VERSION } from './matchConfig.js';

export interface MatchOptions {
  /** Interval в ms между tick'ами. Default 100 (10 TPS). Test override: 5-10. */
  tickIntervalMs?: number;
}

export class Match {
  readonly matchId: string;
  readonly seed: number;
  readonly startedAt: number;
  readonly config: SandboxConfig;
  readonly room: Room;
  /** Полный timeline всех deploys — для replay сохранения (Day 12). */
  readonly deployTimeline: DeployAction[] = [];

  private sim: SimState;
  private tickHandle: NodeJS.Timeout | null = null;
  private finished = false;
  private readonly tickIntervalMs: number;

  constructor(room: Room, config: SandboxConfig, matchId: string, opts: MatchOptions = {}) {
    this.room = room;
    this.config = config;
    this.matchId = matchId;
    this.seed = config.seed;
    this.startedAt = Date.now();
    this.tickIntervalMs = opts.tickIntervalMs ?? 100;
    this.sim = this.buildSim();
  }

  /** Start tick loop. */
  start(): void {
    if (this.tickHandle || this.finished) return;
    this.tickHandle = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  /** Force stop без match_ended. Используется при server shutdown. */
  stop(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    this.finished = true;
  }

  /** Принудительное завершение с указанием победителя. Disconnect handler. */
  endWith(winnerIndex: number | null, reason: string): void {
    if (this.finished) return;
    const result = this.makeResult(winnerIndex, reason);
    this.finishAndBroadcast(result);
  }

  get currentTick(): number { return this.sim.tick; }
  get isFinished(): boolean { return this.finished; }
  get simState(): Readonly<SimState> { return this.sim; }

  // ─── private ─────────────────────────────────────────────────────────────

  private tick(): void {
    if (this.finished) return;

    // Step engine. Day 5: добавится deploys из replayPlaybackDeploy.
    stepLangton(this.sim);

    // Broadcast match_tick. Day 5: deploys array заполнится при наличии inputs.
    this.room.broadcast({
      type: 'match_tick',
      tick: this.sim.tick,
      deploys: [],
    });

    // Win condition check — Day 4 только time-based.
    const wc = this.config.winCondition;
    if (wc.kind === 'time' && this.sim.tick >= wc.threshold) {
      this.finishAndBroadcast(this.makeResult(null, 'time_expired'));
    }
  }

  private finishAndBroadcast(result: MatchResult): void {
    this.finished = true;
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    this.room.status = 'finished';
    this.room.broadcast({
      type: 'match_ended',
      result,
      replayUrl: `/api/replays/${this.matchId}.json`,
    });
  }

  private makeResult(winnerIdx: number | null, reason: string): MatchResult {
    const winner = winnerIdx != null ? this.config.players[winnerIdx] : null;
    return {
      finished: true,
      winnerId: winner?.id ?? null,
      winnerName: winner?.name ?? null,
      reason,
      finishedAtTick: this.sim.tick,
      bannerVisible: true,
    };
  }

  private buildSim(): SimState {
    const ants = buildAntsFromConfig(this.config);
    const birthConfig = buildBirthConfig(this.config);
    return makeLangtonState({
      w: this.config.width,
      h: this.config.height,
      ants,
      seed: this.config.seed,
      collisionCooldownTicks: this.config.collisionCooldownTicks,
      hpEnabled: this.config.hpEnabled,
      damageCapEnabled: this.config.damageCapEnabled,
      birthConfig,
      topology: this.config.topology as 'torus' | 'wall' | 'bounce' | 'void',
    });
  }
}

// ─── Helpers (exported для тестов) ───────────────────────────────────────────

export function buildAntsFromConfig(config: SandboxConfig): Ant[] {
  const list: Ant[] = [];
  config.players.forEach((p, pi) => {
    const playerRule = LA_RULES[p.ruleId] ?? LA_RULES.classic!;
    p.ants.forEach((a) => {
      const rule = a.ruleOverride ? (LA_RULES[a.ruleOverride] ?? playerRule) : playerRule;
      list.push({
        id: a.id,
        owner: pi,
        x: a.x,
        y: a.y,
        dir: a.dir,
        rule,
        hp: p.startHp,
        maxHp: p.startHp,
        lastDamageTick: -9999,
        bornAt: 0,
      });
    });
  });
  return list;
}

export function buildBirthConfig(c: SandboxConfig): BirthConfig | null {
  if (!c.birthEnabled) return null;
  return {
    enabled: true,
    minNeighbors:     c.birthMinNeighbors,
    cooldownTicks:    c.birthCooldownTicks,
    maxAntsPerPlayer: c.maxAntsPerPlayer,
    hybridChance:     c.hybridChance,
    wildChance:       c.wildBirthChance,
    unlimited:        c.unlimitedAnts,
    mutation: c.mutation.enabled ? {
      haloEnabled:       c.mutation.haloEnabled,
      haloMinNeighbors:  c.mutation.haloMinNeighbors,
      mirrorEnabled:     c.mutation.mirrorEnabled,
      mirrorRadius:      c.mutation.mirrorRadius,
      pathEnabled:       c.mutation.pathEnabled,
      pathStraightTicks: c.mutation.pathStraightTicks,
    } : undefined,
    reserveMode: c.reserveMode,
    // onReserve — Day 5 deploy mode
  };
}

/** Метаданные для match_started message. */
export function serverEngineMeta(): { version: string } {
  return { version: SERVER_ENGINE_VERSION };
}
