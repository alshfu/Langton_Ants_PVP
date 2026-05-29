// src/lib/botPlayer.ts
//
// Stage 8 Day 31: client-side bot opponent.
//
// Bot открывает вторую WebSocket connection в той же browser tab,
// joins room как обычный player, auto-mark'ает себя ready, и во время
// match'а periodically шлёт deploy actions. Сервер видит его как
// regular player — никаких protocol изменений не требуется.
//
// 3 difficulty levels:
//   • easy:   slow интервалы (deploy ~ каждые 5 секунд), random location
//   • normal: средние (~3 сек), bias toward opp's half
//   • hard:   fast (~1.5 сек), aggressive — opp's quadrant, fast deploys
//
// Pure helpers (pickDeployLocation, shouldDeploy) тестируются отдельно
// без real WS connection.

import type { ClientMessage, ServerMessage, SandboxConfig } from '@langton/core';
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
}

const PARAMS: Record<BotDifficulty, DifficultyParams> = {
  easy:   { deployIntervalTicks: 50, opponentBias: 0.0 },  // ~5s @ 10 TPS
  normal: { deployIntervalTicks: 30, opponentBias: 0.5 },  // ~3s
  hard:   { deployIntervalTicks: 15, opponentBias: 0.85 }, // ~1.5s, aggressive
};

/**
 * Решает должен ли бот deploy'ить на этом tick'е. Просто проверяет
 * если ticksSinceLastDeploy ≥ interval. Caller updates lastDeployTick
 * после успешного deploy'я.
 */
export function shouldDeploy(
  currentTick: number,
  lastDeployTick: number,
  difficulty: BotDifficulty,
): boolean {
  if (currentTick === lastDeployTick) return false; // already deployed this tick
  const interval = PARAMS[difficulty].deployIntervalTicks;
  return currentTick - lastDeployTick >= interval;
}

/**
 * Pick deploy coordinates {x, y}. Pure function — берёт grid size,
 * мой slot index, difficulty, и random function (для тестируемости).
 *
 * Difficulty влияет на bias:
 * - easy: completely random — covers всё поле
 * - normal: 50% in opp's half — moderate aggression
 * - hard: 85% in opp's quadrant — very aggressive
 *
 * "Opponent quadrant" определяется simple heuristic: для slot 0
 * это правая-нижняя четверть, для slot 1 — левая-верхняя.
 * (Default match config: p0 spawn в (5,5), p1 в (54,54).)
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
    // Opponent's quadrant. mySlot=0 → opp в (max-half, max-half). mySlot=1 → opp в (0, 0).
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

/** Display name бота — показывается в PlayerSlot. */
export function botDisplayName(difficulty: BotDifficulty): string {
  const titleCase = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  return `🤖 Bot (${titleCase})`;
}

/** Идентификация бота по nickname (для UI styling). */
export function isBotNickname(nickname: string): boolean {
  return nickname.startsWith('🤖 ');
}

// ─── BotPlayer class ─────────────────────────────────────────────────────────

export class BotPlayer {
  private ws: WSClient | null = null;
  private mySlotIdx: number | null = null;
  private myClientId: string | null = null;
  private config: SandboxConfig | null = null;
  private currentTick = 0;
  private lastDeployTick = -1;
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
        // Если slot index изменился (например opp пересел) — refresh
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
        break;
      case 'match_started':
        this.opts.onState?.('in_match');
        break;
      case 'match_tick':
        this.currentTick = msg.tick;
        this.maybeDeploy();
        break;
      case 'match_ended':
        // Bot не запрашивает rematch — disconnect, user может попросить
        // нового бота если хочет ещё.
        this.stop();
        break;
      case 'rematch_reset':
        // Кто-то rematch'нул, но bot уже закрыл WS — это не должно случаться
        // (Bot ушёл на match_ended). Если случилось — disconnect.
        this.stop();
        break;
      case 'error':
        // Игнорируем — даже если deploy reject'нут (out of bounds случай) —
        // в следующем tick'е выберем другое место.
        break;
      default:
        // Pong, match_resume_state, и другие — игнорируем для бота.
        break;
    }
  }

  private maybeDeploy(): void {
    if (!this.config || this.mySlotIdx == null) return;
    if (!shouldDeploy(this.currentTick, this.lastDeployTick, this.opts.difficulty)) return;
    const loc = pickDeployLocation(
      this.config.width,
      this.config.height,
      this.mySlotIdx,
      this.opts.difficulty,
    );
    this.lastDeployTick = this.currentTick;
    this.ws?.send({
      type: 'deploy',
      tick: this.currentTick,
      x: loc.x,
      y: loc.y,
    } as Extract<ClientMessage, { type: 'deploy' }>);
  }
}
