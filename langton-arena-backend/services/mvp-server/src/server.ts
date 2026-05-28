// src/server.ts
//
// MvpServer — WebSocket server обёртка. Tracks connections, маршрутизирует
// сообщения через routeMessage(). Stage 8 Day 2 — только plumbing, room/match
// state будет добавлен в Day 3+.

import { WebSocketServer, type WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { Connection } from './connection.js';
import { routeMessage, leaveCurrentRoom } from './router.js';
import { RoomManager } from './roomManager.js';

export interface MvpServerOptions {
  /** Port. 0 для random — полезно для тестов. Default 8080. */
  port?: number;
  /** Host. Default '127.0.0.1' (loopback). */
  host?: string;
  /** Логгер — простой callback. Default console.log. */
  logger?: (level: 'info' | 'warn' | 'error', msg: string, meta?: object) => void;
}

export class MvpServer {
  private wss: WebSocketServer | null = null;
  private connections: Set<Connection> = new Set();
  readonly rooms: RoomManager = new RoomManager();
  private readonly logger: NonNullable<MvpServerOptions['logger']>;
  private readonly host: string;
  private readonly port: number;

  constructor(opts: MvpServerOptions = {}) {
    this.host = opts.host ?? '127.0.0.1';
    this.port = opts.port ?? 8080;
    this.logger = opts.logger ?? ((level, msg, meta) => {
      const ts = new Date().toISOString();
      const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
      console.log(`[${ts}] [${level}] ${msg}${metaStr}`);
    });
  }

  /** Запустить сервер. Resolve когда listening. */
  async start(): Promise<{ host: string; port: number }> {
    if (this.wss) throw new Error('server already started');

    this.wss = new WebSocketServer({ host: this.host, port: this.port });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
    this.wss.on('error', (err) => {
      this.logger('error', 'WSS error', { err: String(err) });
    });

    // Wait listening
    await new Promise<void>((resolve) => {
      this.wss!.once('listening', resolve);
    });

    const addr = this.wss.address() as AddressInfo;
    this.logger('info', 'mvp-server listening', { host: addr.address, port: addr.port });
    return { host: addr.address, port: addr.port };
  }

  /** Graceful shutdown — close all connections, then close server. */
  async stop(): Promise<void> {
    if (!this.wss) return;
    for (const conn of this.connections) {
      conn.close('server-shutdown');
    }
    this.connections.clear();
    await new Promise<void>((resolve, reject) => {
      this.wss!.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    this.wss = null;
    this.logger('info', 'mvp-server stopped');
  }

  /** Number of active connections (for tests / monitoring). */
  get connectionCount(): number {
    return this.connections.size;
  }

  private handleConnection(ws: WebSocket): void {
    const conn = new Connection(ws);
    this.connections.add(conn);
    this.logger('info', 'client connected', { clientId: conn.clientId });

    ws.on('message', (data) => {
      // ws library types: data может быть Buffer | ArrayBuffer | Buffer[]. Нормализуем.
      const raw = Array.isArray(data) ? Buffer.concat(data) : (data as Buffer);
      routeMessage(conn, raw, this.rooms);
    });

    ws.on('close', () => {
      this.connections.delete(conn);
      conn.closed = true;
      // Stage 8 Day 3: cleanup room state + broadcast другим игрокам
      leaveCurrentRoom(conn, this.rooms);
      this.logger('info', 'client disconnected', {
        clientId: conn.clientId,
        duration: Date.now() - conn.connectedAt,
      });
    });

    ws.on('error', (err) => {
      this.logger('warn', 'connection error', { clientId: conn.clientId, err: String(err) });
    });
  }
}
