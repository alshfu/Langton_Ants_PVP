// src/connection.ts
//
// Wrapper над WebSocket — per-client state + safe send/close helpers.
// В Stage 8 Day 2 — только базовая инфраструктура. Room/Match links
// добавятся в Day 3/4.

import type { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import type { ServerMessage, ErrorCode } from './messages.js';
import { t, normalizeLocale, type Locale, DEFAULT_LOCALE } from './i18n.js';

export class Connection {
  /** Уникальный идентификатор клиента (per WS connection). */
  readonly clientId: string;
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

  constructor(public readonly ws: WebSocket) {
    this.clientId = randomUUID();
    this.connectedAt = Date.now();
    this.locale = DEFAULT_LOCALE;
    this.roomCode = null;
    this.nickname = '';
    this.ready = false;
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

  /** Отправить error с локализованным message. Безопасно по shape. */
  sendError(code: ErrorCode): void {
    this.send({
      type: 'error',
      code,
      message: t(this.locale, code),
      locale: this.locale,
    });
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
