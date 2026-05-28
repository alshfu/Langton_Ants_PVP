// src/server.ts
//
// MvpServer — WebSocket server обёртка. Stage 8 Day 4.
// Owns: WebSocketServer + Set<Connection> + ServerContext (rooms + match timing).
// Routes incoming messages через routeMessage + cleanup on disconnect.

import { WebSocketServer, type WebSocket } from 'ws';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Connection } from './connection.js';
import { routeMessage, handleConnectionClose } from './router.js';
import { RoomManager } from './roomManager.js';
import { makeContext, type ServerContext } from './serverContext.js';

export interface MvpServerOptions {
  /** Port. 0 для random — полезно для тестов. Default 8080. */
  port?: number;
  /** Host. Default '127.0.0.1' (loopback). */
  host?: string;
  /** Логгер — простой callback. Default console.log. */
  logger?: (level: 'info' | 'warn' | 'error', msg: string, meta?: object) => void;
  /** match_starting countdown ms. Default 3000. Test override: 50. */
  matchCountdownMs?: number;
  /** Match tick interval ms. Default 100 (10 TPS). Test override: 5. */
  matchTickIntervalMs?: number;
  /** Day 13: grace ms для reconnect. Default 15000. Test override: 100. */
  graceDisconnectMs?: number;
}

export class MvpServer {
  private wss: WebSocketServer | null = null;
  private httpServer: HttpServer | null = null;
  private connections: Set<Connection> = new Set();
  readonly ctx: ServerContext;
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
    this.ctx = makeContext({
      rooms: new RoomManager(),
      matchCountdownMs: opts.matchCountdownMs,
      matchTickIntervalMs: opts.matchTickIntervalMs,
      graceDisconnectMs: opts.graceDisconnectMs,
    });
  }

  /** Backwards-compat: expose rooms (для tests которые ссылались на server.rooms). */
  get rooms(): RoomManager { return this.ctx.rooms; }

  async start(): Promise<{ host: string; port: number }> {
    if (this.wss) throw new Error('server already started');

    // Day 13.5: единый http.Server обслуживает и health-check GET и WS upgrade.
    // Нужно для Render/Cloud Run/большинства hostings — они проверяют HTTP /
    // перед routing'ом трафика. Pure-WS server упадёт на health check.
    this.httpServer = createServer((req, res) => {
      const url = req.url ?? '/';
      if (url === '/' || url === '/health' || url === '/healthz') {
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-store',
        });
        res.end('OK · Langton Arena PvP MVP server\n');
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found\n');
    });

    this.wss = new WebSocketServer({ server: this.httpServer });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
    this.wss.on('error', (err) => {
      this.logger('error', 'WSS error', { err: String(err) });
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.once('listening', resolve);
      this.httpServer!.once('error', reject);
      this.httpServer!.listen(this.port, this.host);
    });

    const addr = this.httpServer.address() as AddressInfo;
    this.logger('info', 'mvp-server listening', { host: addr.address, port: addr.port });
    return { host: addr.address, port: addr.port };
  }

  async stop(): Promise<void> {
    if (!this.wss) return;
    // Stop all active matches first (prevents tick interval leaks after server shutdown)
    for (const room of this.ctx.rooms.all) {
      if (room.activeMatch) room.activeMatch.stop();
      if (room.countdownHandle) {
        clearTimeout(room.countdownHandle);
        room.countdownHandle = null;
      }
      // Day 13: clear pending grace timers — иначе они выстрелят после shutdown
      for (const timer of room.graceTimers.values()) clearTimeout(timer);
      room.graceTimers.clear();
    }
    for (const conn of this.connections) {
      conn.close('server-shutdown');
    }
    this.connections.clear();
    this.ctx.rooms.clear();
    await new Promise<void>((resolve, reject) => {
      this.wss!.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    // Close underlying http.Server (если был создан в start())
    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.httpServer = null;
    }
    this.wss = null;
    this.logger('info', 'mvp-server stopped');
  }

  get connectionCount(): number {
    return this.connections.size;
  }

  private handleConnection(ws: WebSocket): void {
    const conn = new Connection(ws);
    this.connections.add(conn);
    this.logger('info', 'client connected', { clientId: conn.clientId });

    ws.on('message', (data) => {
      const raw = Array.isArray(data) ? Buffer.concat(data) : (data as Buffer);
      routeMessage(conn, raw, this.ctx);
    });

    ws.on('close', () => {
      this.connections.delete(conn);
      conn.closed = true;
      // Stage 8 Day 13: split на grace (mid-match) vs immediate (others).
      // handleConnectionClose возвращает true если grace mode (conn остался
      // в room.players с disconnected=true и таймером).
      const grace = handleConnectionClose(conn, this.ctx);
      this.logger('info', 'client disconnected', {
        clientId: conn.clientId,
        duration: Date.now() - conn.connectedAt,
        graceMode: grace,
      });
    });

    ws.on('error', (err) => {
      this.logger('warn', 'connection error', { clientId: conn.clientId, err: String(err) });
    });
  }
}
