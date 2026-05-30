// src/matchmaker.ts
//
// Stage 9.3: matchmaker — ELO/SR based queue matching.
//
// Algorithm: expanding window. Каждые 2 секунды:
//   1. Iterate queue по joinTime ascending
//   2. Для каждого entry: window = 50 + 30 * waitSeconds → expands over time
//   3. Find ANY pending entry в window → match
//   4. Pair found → create room, notify both clients, dequeue
//
// Bot fallback: если waitSec > 60 — отправляем matchmaking_status с
// botFallbackOffered=true. Client может accept_bot_fallback.

import type { Connection } from './connection.js';
import type { RoomManager } from './roomManager.js';
import type { PersistenceLayer } from './persistence.js';
import { generateRoomCode } from './roomCodes.js';

const SWEEP_INTERVAL_MS = 2000;
const BASE_WINDOW = 50;
const WINDOW_GROWTH_PER_SEC = 30;
const MAX_WINDOW = 400;
const BOT_FALLBACK_THRESHOLD_SEC = 60;

export interface QueueEntry {
  conn: Connection;
  rating: number;
  joinedAt: number;
  nickname: string;
}

export class Matchmaker {
  private queue: QueueEntry[] = [];
  private sweepHandle: NodeJS.Timeout | null = null;
  private statusHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly rooms: RoomManager,
    private readonly persistence: PersistenceLayer,
  ) {
    void this.rooms; // зарезервировано для будущего room creation upon pair
  }

  /** Start periodic sweep + status broadcasts. */
  start(): void {
    if (this.sweepHandle) return;
    this.sweepHandle = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.statusHandle = setInterval(() => this.broadcastStatus(), 1000);
  }

  /** Stop sweep — на server shutdown. */
  stop(): void {
    if (this.sweepHandle) {
      clearInterval(this.sweepHandle);
      this.sweepHandle = null;
    }
    if (this.statusHandle) {
      clearInterval(this.statusHandle);
      this.statusHandle = null;
    }
  }

  /** Add connection to queue. Idempotent (если уже в queue — no-op). */
  async enqueue(conn: Connection, nickname: string): Promise<void> {
    if (this.queue.some((e) => e.conn === conn)) return;
    // Get user rating если есть persistent identity
    let rating = 1500;
    if (conn.userId) {
      const user = await this.persistence.getUserStats(conn.userId);
      if (user) rating = user.rating;
    }
    this.queue.push({
      conn,
      rating,
      joinedAt: Date.now(),
      nickname,
    });
  }

  /** Remove from queue. Returns true if was queued. */
  dequeue(conn: Connection): boolean {
    const idx = this.queue.findIndex((e) => e.conn === conn);
    if (idx < 0) return false;
    this.queue.splice(idx, 1);
    return true;
  }

  /** True если connection в queue. */
  has(conn: Connection): boolean {
    return this.queue.some((e) => e.conn === conn);
  }

  /** Current queue size. */
  size(): number {
    return this.queue.length;
  }

  /** Periodic sweep — pairs entries within rating window. */
  private sweep(): void {
    // Skip dead connections
    this.queue = this.queue.filter((e) => !e.conn.closed && !e.conn.disconnected);

    if (this.queue.length < 2) return;

    const now = Date.now();
    // Sort by joinedAt asc — oldest first
    const sorted = this.queue.slice().sort((a, b) => a.joinedAt - b.joinedAt);

    const paired = new Set<Connection>();
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]!;
      if (paired.has(a.conn)) continue;
      const waitSec = (now - a.joinedAt) / 1000;
      const window = Math.min(MAX_WINDOW, BASE_WINDOW + WINDOW_GROWTH_PER_SEC * waitSec);

      // Find pairing partner
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j]!;
        if (paired.has(b.conn)) continue;
        if (Math.abs(a.rating - b.rating) <= window) {
          this.pair(a, b);
          paired.add(a.conn);
          paired.add(b.conn);
          break;
        }
      }
    }
  }

  /** Create room with random code и notify both. */
  private pair(a: QueueEntry, b: QueueEntry): void {
    const roomCode = generateRoomCode();
    // Remove both from queue
    this.queue = this.queue.filter((e) => e.conn !== a.conn && e.conn !== b.conn);
    // Notify both — client navigates на /?room=XXX
    a.conn.send({
      type: 'match_found',
      roomCode,
      opponentNickname: b.nickname,
    });
    b.conn.send({
      type: 'match_found',
      roomCode,
      opponentNickname: a.nickname,
    });
  }

  /** Periodic status broadcast — каждую секунду шлём каждому в queue. */
  private broadcastStatus(): void {
    const now = Date.now();
    for (const entry of this.queue) {
      if (entry.conn.closed || entry.conn.disconnected) continue;
      const waitSec = Math.floor((now - entry.joinedAt) / 1000);
      const botFallbackOffered = waitSec >= BOT_FALLBACK_THRESHOLD_SEC;
      entry.conn.send({
        type: 'matchmaking_status',
        waitSec,
        queueSize: this.queue.length,
        ...(botFallbackOffered ? { botFallbackOffered: true } : {}),
      });
    }
  }
}
