// src/lib/botPlayer.ts
//
// Stage 8 Day 31: client-side bot opponent.
// Stage 8 Day 33: smart bot — sim state tracking, frontier targeting,
// jittered intervals, initial burst, adaptive Hard.
//
// Bot открывает вторую WebSocket connection в той же browser tab,
// joins room как обычный player, auto-mark'ает себя ready, и во время
// match'а periodically шлёт deploy actions.
//
// Day 33 improvements:
// - Sim state tracking через @langton/core engine — бот видит реальную
//   территорию каждый тик
// - Smart positioning: frontier cells (свои edges) для Normal/Hard
// - Jittered intervals: ±20% randomness — бот не предсказуем по ритму
// - Initial burst: первые 3 deploys на shorter intervals
// - Adaptive Hard: panic mode (deploy 50% faster) если отстаю

import type { ClientMessage, ServerMessage, SandboxConfig, SimState, BirthConfig } from '@langton/core';
import {
  makeLangtonState, stepLangton, applyDeployAction,
  buildAntsFromConfig, buildBirthConfig,
} from '@langton/core';
import { WSClient } from './wsClient';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export interface BotConfig {
  url: string;
  roomCode: string;
  difficulty: BotDifficulty;
  /** Callback при состоянии бота — useful для UI feedback. */
  onState?: (state: 'connecting' | 'in_lobby' | 'in_match' | 'disconnected') => void;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

interface DifficultyParams {
  /** Каждые N ticks бот пытается deploy'ить. */
  deployIntervalTicks: number;
  /** Bias toward opponent's quadrant: 0 = anywhere, 1 = всегда opp side. */
  opponentBias: number;
  /** Day 33: вероятность использовать smart frontier-based picker. */
  smartProbability: number;
  /** Day 33: для smart picker — true=frontier только vs enemy cells, false=any non-my. */
  frontierStrictEnemy: boolean;
}

const PARAMS: Record<BotDifficulty, DifficultyParams> = {
  easy:   { deployIntervalTicks: 50, opponentBias: 0.0,  smartProbability: 0.0, frontierStrictEnemy: false },
  normal: { deployIntervalTicks: 30, opponentBias: 0.5,  smartProbability: 0.4, frontierStrictEnemy: false },
  hard:   { deployIntervalTicks: 15, opponentBias: 0.85, smartProbability: 0.7, frontierStrictEnemy: true  },
};

/** Day 33: initial burst — N первых deploys используют этот короткий interval. */
const INITIAL_BURST_COUNT = 3;
const INITIAL_BURST_INTERVAL = 8; // ~0.8s @ 10 TPS

/**
 * Day 31 (legacy, без jitter). Caller updates lastDeployTick после
 * успешного deploy'я.
 */
export function shouldDeploy(
  currentTick: number,
  lastDeployTick: number,
  difficulty: BotDifficulty,
): boolean {
  if (currentTick === lastDeployTick) return false;
  const interval = PARAMS[difficulty].deployIntervalTicks;
  return currentTick - lastDeployTick >= interval;
}

/**
 * Day 33: jittered версия — interval randomly modified by ±jitterFactor.
 * Default jitter 0.2 = ±20%. Bot становится менее предсказуем по ритму.
 *
 * Также supports initial burst phase: первые `deployCount` < INITIAL_BURST_COUNT
 * используют shorter interval (8 ticks).
 *
 * panicMode: hard difficulty + я отстаю → interval halved.
 */
export function shouldDeployJittered(
  currentTick: number,
  lastDeployTick: number,
  difficulty: BotDifficulty,
  deployCount: number,
  panicMode: boolean = false,
  random: () => number = Math.random,
  jitterFactor: number = 0.2,
): boolean {
  if (currentTick === lastDeployTick) return false;
  let baseInterval = PARAMS[difficulty].deployIntervalTicks;
  // Initial burst — first 3 deploys
  if (deployCount < INITIAL_BURST_COUNT) {
    baseInterval = INITIAL_BURST_INTERVAL;
  }
  // Panic mode (Hard + behind) → 50% faster
  if (panicMode) {
    baseInterval = Math.max(5, Math.floor(baseInterval * 0.5));
  }
  // Jitter ±factor
  const jitter = (random() - 0.5) * 2 * jitterFactor;
  const adjustedInterval = Math.max(1, Math.round(baseInterval * (1 + jitter)));
  return currentTick - lastDeployTick >= adjustedInterval;
}

/**
 * Pick deploy coordinates {x, y}. Pure function — берёт grid size,
 * мой slot index, difficulty, и random function (для тестируемости).
 *
 * Day 31 (без sim state): просто uniform random или bias toward opp quadrant.
 */
export function pickDeployLocation(
  gridWidth: number,
  gridHeight: number,
  mySlotIdx: number,
  difficulty: BotDifficulty,
  random: () => number = Math.random,
): { x: number; y: number } {
  const bias = PARAMS[difficulty].opponentBias;
  const useOpponentArea = random() < bias;

  let xRange: [number, number];
  let yRange: [number, number];
  if (useOpponentArea) {
    if (mySlotIdx === 0) {
      xRange = [Math.floor(gridWidth / 2), gridWidth - 1];
      yRange = [Math.floor(gridHeight / 2), gridHeight - 1];
    } else {
      xRange = [0, Math.floor(gridWidth / 2)];
      yRange = [0, Math.floor(gridHeight / 2)];
    }
  } else {
    xRange = [0, gridWidth - 1];
    yRange = [0, gridHeight - 1];
  }

  const x = Math.floor(random() * (xRange[1] - xRange[0] + 1)) + xRange[0];
  const y = Math.floor(random() * (yRange[1] - yRange[0] + 1)) + yRange[0];
  return { x, y };
}

/**
 * Day 33: find frontier cells — мои клетки adjacent к non-my (или specifically enemy).
 * Используется для smart positioning (Normal/Hard).
 *
 * O(W*H) single pass. Для 60×60 grid (3600 cells) это microseconds.
 */
export function findFrontierCells(
  sim: SimState,
  width: number,
  height: number,
  mySlotIdx: number,
  strictEnemy: boolean,
): Array<{ x: number; y: number }> {
  const myOwner = mySlotIdx + 1; // engine encoding: owner = playerIdx + 1
  const result: Array<{ x: number; y: number }> = [];
  const offsets: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cellOwner = sim.owner[y * width + x];
      if (cellOwner !== myOwner) continue;

      for (const [dx, dy] of offsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nOwner = sim.owner[ny * width + nx];
        if (strictEnemy) {
          // Only enemy player cells count (not neutral, not wild)
          if (nOwner !== 0 && nOwner !== myOwner && nOwner !== 255) {
            result.push({ x, y });
            break;
          }
        } else {
          // Any non-my cell (neutral, enemy, wild)
          if (nOwner !== myOwner) {
            result.push({ x, y });
            break;
          }
        }
      }
    }
  }
  return result;
}

/**
 * Day 33: pick smart location используя sim state.
 * Если sim null или нет frontier cells — fallback на legacy pickDeployLocation.
 *
 * difficulty → smartProbability: chance что мы используем smart logic vs random.
 * - easy: 0% (всегда random)
 * - normal: 40% smart (mostly random, some strategic)
 * - hard: 70% smart (mostly strategic)
 */
export function pickSmartDeployLocation(
  sim: SimState | null,
  config: SandboxConfig,
  mySlotIdx: number,
  difficulty: BotDifficulty,
  random: () => number = Math.random,
): { x: number; y: number } {
  if (!sim) {
    return pickDeployLocation(config.width, config.height, mySlotIdx, difficulty, random);
  }
  const params = PARAMS[difficulty];
  const useSmart = random() < params.smartProbability;
  if (!useSmart) {
    return pickDeployLocation(config.width, config.height, mySlotIdx, difficulty, random);
  }
  const frontiers = findFrontierCells(sim, config.width, config.height, mySlotIdx, params.frontierStrictEnemy);
  if (frontiers.length === 0) {
    return pickDeployLocation(config.width, config.height, mySlotIdx, difficulty, random);
  }
  return frontiers[Math.floor(random() * frontiers.length)]!;
}

/**
 * Day 33: compute мою территорию % из sim. Используется для adaptive Hard.
 * Returns [0..100].
 */
export function computeMyTerritoryPercent(
  sim: SimState,
  mySlotIdx: number,
  width: number,
  height: number,
): number {
  const myOwner = mySlotIdx + 1;
  const total = width * height;
  let mine = 0;
  for (let i = 0; i < total; i++) {
    if (sim.owner[i] === myOwner) mine++;
  }
  return (mine / total) * 100;
}

/**
 * Day 33: detect panic mode — am I behind enemy?
 * Только для Hard difficulty — Easy/Normal ignore.
 */
export function isPanicMode(
  sim: SimState | null,
  mySlotIdx: number,
  width: number,
  height: number,
  difficulty: BotDifficulty,
): boolean {
  if (!sim || difficulty !== 'hard') return false;
  const myPercent = computeMyTerritoryPercent(sim, mySlotIdx, width, height);
  // Считаем opp percent — сумма всех owner != myOwner, != 0 (neutral), != 255 (wild)
  const myOwner = mySlotIdx + 1;
  const total = width * height;
  let opp = 0;
  for (let i = 0; i < total; i++) {
    const o = sim.owner[i];
    if (o !== 0 && o !== myOwner && o !== 255) opp++;
  }
  const oppPercent = (opp / total) * 100;
  return oppPercent > myPercent + 5; // отстаю на >5%
}

/** Display name бота — показывается в PlayerSlot. */
export function botDisplayName(difficulty: BotDifficulty): string {
  // Day 41 fix: убраны emoji + parens чтобы пройти server-side
  // isValidNickname (regex /^[\p{L}\p{N}_\-. ]+$/u — не пропускает 🤖 или ()).
  // Pattern: "Bot-Easy" / "Bot-Normal" / "Bot-Hard".
  // UI добавляет 🤖 emoji при render'е через isBotNickname check.
  const titleCase = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  return `Bot-${titleCase}`;
}

/** Идентификация бота по nickname (для UI styling). */
export function isBotNickname(nickname: string): boolean {
  return /^Bot-(Easy|Normal|Hard)$/.test(nickname);
}

// ─── BotPlayer class ─────────────────────────────────────────────────────────

export class BotPlayer {
  private ws: WSClient | null = null;
  private mySlotIdx: number | null = null;
  private myClientId: string | null = null;
  private config: SandboxConfig | null = null;
  private birthConfig: BirthConfig | null = null;
  private sim: SimState | null = null;
  private currentTick = 0;
  private lastDeployTick = -1;
  private deployCount = 0;
  private disposed = false;

  constructor(private readonly opts: BotConfig) {}

  /** Подключается к room. Returns promise который resolves после join_room. */
  async start(): Promise<void> {
    if (this.ws) throw new Error('bot already started');
    this.opts.onState?.('connecting');

    this.ws = new WSClient({
      url: this.opts.url,
      onMessage: (msg) => this.handleMessage(msg),
      onOpen: () => this.sendJoin(),
    });
    await this.ws.connect();
  }

  /** Disconnect bot — клиент вызывает на match_ended или при ручном выходе. */
  stop(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.opts.onState?.('disconnected');
    this.ws?.disconnect();
    this.ws = null;
  }

  private sendJoin(): void {
    this.ws?.send({
      type: 'join_room',
      roomCode: this.opts.roomCode,
      nickname: botDisplayName(this.opts.difficulty),
      locale: 'en',
    });
  }

  private handleMessage(msg: ServerMessage): void {
    if (this.disposed) return;
    switch (msg.type) {
      case 'room_joined': {
        this.myClientId = msg.clientId;
        const idx = msg.players.findIndex((p) => p.clientId === msg.clientId);
        this.mySlotIdx = idx >= 0 ? idx : null;
        this.opts.onState?.('in_lobby');
        // Auto-Ready
        this.ws?.send({ type: 'set_ready', ready: true });
        break;
      }
      case 'room_updated': {
        if (this.myClientId) {
          const idx = msg.players.findIndex((p) => p.clientId === this.myClientId);
          if (idx >= 0) this.mySlotIdx = idx;
        }
        break;
      }
      case 'match_starting':
        this.config = msg.config;
        this.lastDeployTick = -1;
        this.currentTick = 0;
        this.deployCount = 0;
        // Day 33: initialize local sim state для smart positioning.
        try {
          const ants = buildAntsFromConfig(msg.config);
          this.birthConfig = buildBirthConfig(msg.config);
          this.sim = makeLangtonState({
            w: msg.config.width,
            h: msg.config.height,
            ants,
            seed: msg.seed,
            collisionCooldownTicks: msg.config.collisionCooldownTicks,
            hpEnabled: msg.config.hpEnabled,
            damageCapEnabled: msg.config.damageCapEnabled,
            birthConfig: this.birthConfig,
            topology: msg.config.topology,
            gridType: msg.config.gridType,
          });
        } catch {
          // Если init failed — bot будет на legacy random logic.
          this.sim = null;
        }
        break;
      case 'match_started':
        this.opts.onState?.('in_match');
        break;
      case 'match_tick':
        this.currentTick = msg.tick;
        this.advanceSim(msg.tick, msg.deploys);
        this.maybeDeploy();
        break;
      case 'match_ended':
        this.stop();
        break;
      case 'rematch_reset':
        this.stop();
        break;
      case 'error':
        break;
      default:
        break;
    }
  }

  /** Day 33: step local sim до msg.tick + apply incoming deploys. */
  private advanceSim(targetTick: number, deploys: ReadonlyArray<import('@langton/core').DeployAction>): void {
    if (!this.sim || !this.config) return;
    // Catch up steps. Server sends ticks sequentially так что обычно 1 step.
    while (this.sim.tick < targetTick) {
      stepLangton(this.sim);
    }
    // Apply deploys этого tick'а (после step'а — server тоже так делает)
    for (const d of deploys) {
      applyDeployAction(this.sim, d, this.config);
    }
  }

  private maybeDeploy(): void {
    if (!this.config || this.mySlotIdx == null) return;
    const panic = isPanicMode(
      this.sim, this.mySlotIdx,
      this.config.width, this.config.height,
      this.opts.difficulty,
    );
    if (!shouldDeployJittered(
      this.currentTick, this.lastDeployTick, this.opts.difficulty,
      this.deployCount, panic,
    )) return;

    const loc = pickSmartDeployLocation(
      this.sim, this.config, this.mySlotIdx, this.opts.difficulty,
    );
    this.lastDeployTick = this.currentTick;
    this.deployCount++;
    this.ws?.send({
      type: 'deploy',
      tick: this.currentTick,
      x: loc.x,
      y: loc.y,
    } as Extract<ClientMessage, { type: 'deploy' }>);
  }
}
