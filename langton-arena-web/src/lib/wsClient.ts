// src/lib/wsClient.ts
//
// WSClient — обёртка над native WebSocket. Stage 8 Day 6.
//
// Возможности:
//   - connect(): Promise<void>  — resolves когда WS open
//   - send(msg): no-op если не open (silently drops, тосты в caller)
//   - onMessage callback с parsed JSON + type narrowing
//   - onClose / onError callbacks
//   - state property — для UI индикатора (connecting / open / closed)
//   - auto-reconnect skeleton (выключен по умолчанию, real impl — Stage 9)
//
// Protocol types — из @langton/core, гарантия что client и server говорят
// на одном языке.
//
// Frontend integration (Day 7+): WSClient инстанциируется в MatchScreen.

import type { ClientMessage, ServerMessage } from '@langton/core';

export type WSClientState = 'idle' | 'connecting' | 'open' | 'closed';

export interface WSClientOptions {
  /** ws:// или wss:// URL. */
  url: string;
  /** Callback на каждое incoming сообщение (JSON-parsed). */
  onMessage: (msg: ServerMessage) => void;
  /** Day 13: Callback при каждом успешном open — включая auto-reconnect.
   *  reopen=true при reconnect (не первое open). Caller использует это чтобы
   *  re-send join_room с resumeToken на reconnect. */
  onOpen?: (reopen: boolean) => void;
  /** Callback при close. Аргументы: code (1000=normal), reason. */
  onClose?: (code: number, reason: string) => void;
  /** Callback при error. Аргумент: error object. */
  onError?: (err: Event) => void;
  /** Callback при изменении state. */
  onStateChange?: (state: WSClientState) => void;
  /** Auto-reconnect skeleton — Stage 9 implements полную логику. Default false. */
  autoReconnect?: boolean;
  /** Reconnect delay в ms (если autoReconnect=true). Default 2000. */
  reconnectDelayMs?: number;
  /** Custom WebSocket constructor — для тестов (default — globalThis.WebSocket). */
  websocketCtor?: typeof WebSocket;
}

/**
 * Stage 8 WS client.
 *
 * Использование:
 * ```ts
 * const client = new WSClient({
 *   url: 'ws://localhost:8080',
 *   onMessage: (msg) => {
 *     switch (msg.type) {
 *       case 'room_joined': ...
 *       case 'match_tick':  ...
 *     }
 *   },
 *   onStateChange: (s) => console.log('state:', s),
 * });
 * await client.connect();
 * client.send({ type: 'join_room', roomCode: 'abc', nickname: 'Brave', locale: 'en' });
 * ```
 */
export class WSClient {
  private ws: WebSocket | null = null;
  private _state: WSClientState = 'idle';
  private connectPromise: Promise<void> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private openCount = 0;
  private readonly Ctor: typeof WebSocket;

  constructor(private readonly opts: WSClientOptions) {
    this.Ctor = opts.websocketCtor
      ?? ((typeof WebSocket !== 'undefined') ? WebSocket : undefined as unknown as typeof WebSocket);
    if (!this.Ctor) {
      throw new Error('WSClient: no WebSocket constructor available (provide websocketCtor in opts)');
    }
  }

  /** Текущее состояние клиента. */
  get state(): WSClientState { return this._state; }

  /** Удобный геттер. */
  get isOpen(): boolean { return this._state === 'open'; }

  /** URL который указан в опциях (read-only). */
  get url(): string { return this.opts.url; }

  /**
   * Подключиться. Resolves когда WS state = OPEN.
   * Reject если open failed.
   * Idempotent: повторный вызов возвращает уже-pending promise.
   */
  connect(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('WSClient disposed'));
    if (this._state === 'open') return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.setState('connecting');
      try {
        this.ws = new this.Ctor(this.opts.url);
      } catch (e) {
        this.setState('closed');
        this.connectPromise = null;
        reject(e);
        return;
      }

      this.ws.addEventListener('open', () => {
        this.setState('open');
        this.connectPromise = null;
        const reopen = this.openCount > 0;
        this.openCount++;
        this.opts.onOpen?.(reopen);
        resolve();
      });

      this.ws.addEventListener('message', (ev) => {
        this.handleMessage(ev as MessageEvent);
      });

      this.ws.addEventListener('close', (ev) => {
        const wasOpen = this._state === 'open';
        this.setState('closed');
        this.ws = null;
        const closeEv = ev as CloseEvent;
        this.opts.onClose?.(closeEv.code, closeEv.reason);
        if (this.connectPromise) {
          this.connectPromise = null;
          reject(new Error(`connect failed: ${closeEv.code} ${closeEv.reason || 'no reason'}`));
        }
        // Auto-reconnect skeleton (Stage 9 full)
        if (wasOpen && this.opts.autoReconnect && !this.disposed) {
          this.scheduleReconnect();
        }
      });

      this.ws.addEventListener('error', (ev) => {
        this.opts.onError?.(ev);
      });
    });

    return this.connectPromise;
  }

  /**
   * Отправить message. Serialize в JSON. No-op если соединение не open.
   * Возвращает true если отправлено, false если dropped.
   */
  send(msg: ClientMessage): boolean {
    if (!this.ws || this._state !== 'open') return false;
    try {
      this.ws.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Disconnect и cleanup. После вызова повторный connect/send бесполезны.
   * Idempotent.
   */
  disconnect(code = 1000, reason = 'client-initiated'): void {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(code, reason); } catch { /* swallow */ }
      this.ws = null;
    }
    this.setState('closed');
    this.connectPromise = null;
  }

  // ─── private ─────────────────────────────────────────────────────────────

  private handleMessage(ev: MessageEvent): void {
    if (typeof ev.data !== 'string') return; // ignore binary
    let parsed: unknown;
    try {
      parsed = JSON.parse(ev.data);
    } catch {
      // Server должен слать valid JSON. Если нет — log + continue.
      console.warn('[WSClient] malformed server message:', ev.data);
      return;
    }
    if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
      console.warn('[WSClient] message без type field:', parsed);
      return;
    }
    this.opts.onMessage(parsed as ServerMessage);
  }

  private setState(s: WSClientState): void {
    if (this._state === s) return;
    this._state = s;
    this.opts.onStateChange?.(s);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.disposed) return;
    const delay = this.opts.reconnectDelayMs ?? 2000;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.disposed = false; // unset для повторной попытки
      this.connect().catch(() => {
        // Stage 9: tracking retry count, exponential backoff, max attempts
      });
    }, delay);
  }
}
