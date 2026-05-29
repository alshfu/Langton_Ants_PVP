// src/connection.ts
//
// Wrapper над WebSocket — per-client state + safe send/close helpers.
// В Stage 8 Day 2 — только базовая инфраструктура. Room/Match links
// добавятся в Day 3/4.

import type { WebSocket } from 'ws';
import { randomUUID, randomBytes } from 'node:crypto';
import type { ServerMessage, ErrorCode } from './messages.js';
import { t, normalizeLocale, type Locale, DEFAULT_LOCALE } from './i18n.js';
import { SlidingWindowLimiter, RATE_LIMITS } from '@langton/core';

export class Connection {
  /** Уникальный идентификатор клиента (per WS connection). */
  clientId: string;
  /** Когда клиент подключился (ms since epoch). */
  readonly connectedAt: number;
  /** Локаль для error messages — устанавливается в join_room handler. */
  locale: Locale;
  /** Код комнаты если клиент в room (null до join_room). */
  roomCode: string | null;
  /** Nickname игрока — устанавливается в join_room. Day 3+. */
  nickname: string;
  /** Готов ли игрок (set_ready handler). Day 3+. */
  ready: boolean;
  /** Закрыто ли соединение со стороны сервера/клиента. */
  closed: boolean;
  /** Stage 8 Day 13: resume token для reconnect within grace period.
   *  Генерируется один раз, отправляется client в room_joined,
   *  client персистит в sessionStorage по roomCode. */
  resumeToken: string;
  /** Day 13: помечен ли connection как disconnected (grace period active).
   *  Остаётся в room.players до grace expire / resume. */
  disconnected: boolean;
  /** Day 14: per-connection rate limits.
   *  - messageLimit: общий поток входящих (30/sec) — защита от flood
   *  - deployLimit:  только deploy action'ы (5/sec) — защита от click bot
   *  - errorBudget:  ≥5 errors за 10s → disconnect (broken client / DOS) */
  readonly messageLimit: SlidingWindowLimiter;
  readonly deployLimit: SlidingWindowLimiter;
  readonly errorBudget: SlidingWindowLimiter;

  constructor(public readonly ws: WebSocket) {
    this.clientId = randomUUID();
    this.connectedAt = Date.now();
    this.locale = DEFAULT_LOCALE;
    this.roomCode = null;
    this.nickname = '';
    this.ready = false;
    this.closed = false;
    this.resumeToken = randomBytes(16).toString('hex');
    this.disconnected = false;
    this.messageLimit = new SlidingWindowLimiter(RATE_LIMITS.message);
    this.deployLimit = new SlidingWindowLimiter(RATE_LIMITS.deploy);
    this.errorBudget = new SlidingWindowLimiter(RATE_LIMITS.errorBudget);
  }

  /** Day 13: усыновить state от старого Connection при resume. Сохраняем
   *  всё что должно остаться стабильным (clientId, nickname, locale, ready,
   *  resumeToken, roomCode) — но ws/closed/disconnected обновляются. */
  adoptFrom(old: Connection): void {
    this.clientId = old.clientId;
    this.locale = old.locale;
    this.roomCode = old.roomCode;
    this.nickname = old.nickname;
    this.ready = old.ready;
    this.resumeToken = old.resumeToken;
    this.disconnected = false;
    this.closed = false;
  }

  /** Установить локаль клиента (вызывается из join_room handler). */
  setLocale(input: string): void {
    this.locale = normalizeLocale(input);
  }

  /** Отправить server message. JSON serialize. No-op если соединение закрыто. */
  send(msg: ServerMessage): void {
    if (this.closed) return;
    if (this.ws.readyState !== 1 /* OPEN */) return;
    try {
      this.ws.send(JSON.stringify(msg));
    } catch {
      // Swallow — отправка по закрытому соединению. Cleanup в onclose.
    }
  }

  /**
   * Отправить error с локализованным message. Безопасно по shape.
   * Day 10: опциональный context для client-side prediction reconciliation.
   * Когда передан — client сможет сопоставить error с конкретным pending
   * deploy (через x/y) и rollback его ghost.
   */
  sendError(code: ErrorCode, context?: { x?: number; y?: number; tick?: number }): void {
    this.send({
      type: 'error',
      code,
      message: t(this.locale, code),
      locale: this.locale,
      ...(context ? { context } : {}),
    });
  }

  /**
   * Day 14: учесть error в budget. Возвращает true если budget исчерпан и
   * caller должен disconnect connection.
   *
   * RATE_LIMIT_EXCEEDED НЕ должен попадать сюда — иначе rate-limited
   * клиент сразу banится в feedback loop.
   */
  recordError(now: number = Date.now()): boolean {
    const ok = this.errorBudget.tryHit(now);
    return !ok; // true = превышен бюджет
  }

  /** Закрыть соединение. Idempotent. */
  close(reason?: string): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.ws.close(1000, reason ?? 'server-initiated');
    } catch {
      /* swallow */
    }
  }
}
