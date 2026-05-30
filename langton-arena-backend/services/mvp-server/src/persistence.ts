// src/persistence.ts
//
// Stage 9.2: persistence layer для match records, user stats, replays.
//
// MVP impl: JSON-file storage (no external deps, simple to test).
// Future: migrate к SQLite (Stage 9.8) или Postgres (Stage 10+).
//
// Architecture: PersistenceLayer interface + 2 implementations:
//   - JsonFilePersistence — file-backed, single-file atomic writes
//   - NoOpPersistence — for tests где persistence не критична

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SandboxConfig, MatchResult, Replay } from '@langton/core';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;             // UUID
  deviceId: string;
  nickname: string;
  createdAt: number;
  lastActive: number;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  rating: number;         // ELO, start 1500
}

export interface MatchRecord {
  id: string;             // matchId
  startedAt: number;
  finishedAt?: number;
  durationTicks?: number;
  configJson: string;     // SandboxConfig stringified
  winnerUserId: string | null;
  reason: string;
  replayJson?: string;
  participants: ParticipantRecord[];
}

export interface ParticipantRecord {
  userId: string;
  playerIdx: number;
  finalTerritoryPct: number;
  ratingBefore?: number;
  ratingAfter?: number;
}

/** Stage 9.5: filters для public replays browser. */
export interface ReplayQuery {
  limit?: number;        // default 20, max 100
  offset?: number;       // default 0
  winConditionKind?: string;  // filter by config.winCondition.kind
  since?: number;        // unix ms — exclude matches startedAt < since
  finishedOnly?: boolean; // default true — exclude matches без finishedAt
}

export interface PersistenceLayer {
  upsertUser(deviceId: string, nickname: string): Promise<User>;
  getUserStats(userId: string): Promise<User | null>;
  recordMatchStart(matchId: string, config: SandboxConfig, userIds: string[]): Promise<void>;
  recordMatchEnd(matchId: string, result: MatchResult, replay: Replay | null): Promise<void>;
  getRecentMatches(limit: number): Promise<MatchRecord[]>;
  /** Stage 9.5: filtered listing для public browser. */
  queryMatches(q: ReplayQuery): Promise<{ items: MatchRecord[]; total: number }>;
  getMatch(matchId: string): Promise<MatchRecord | null>;
  close(): Promise<void>;
}

// ─── NoOpPersistence для tests ──────────────────────────────────────────────

export class NoOpPersistence implements PersistenceLayer {
  async upsertUser(deviceId: string, nickname: string): Promise<User> {
    return {
      id: `noop-${deviceId}`,
      deviceId,
      nickname,
      createdAt: Date.now(),
      lastActive: Date.now(),
      totalMatches: 0, wins: 0, losses: 0, draws: 0,
      rating: 1500,
    };
  }
  async getUserStats(_userId: string): Promise<User | null> { return null; }
  async recordMatchStart(_matchId: string, _config: SandboxConfig, _userIds: string[]): Promise<void> {}
  async recordMatchEnd(_matchId: string, _result: MatchResult, _replay: Replay | null): Promise<void> {}
  async getRecentMatches(_limit?: number): Promise<MatchRecord[]> { return []; }
  async queryMatches(_q: ReplayQuery): Promise<{ items: MatchRecord[]; total: number }> {
    return { items: [], total: 0 };
  }
  async getMatch(_matchId: string): Promise<MatchRecord | null> { return null; }
  async close(): Promise<void> {}
}

// ─── JsonFilePersistence ────────────────────────────────────────────────────

interface DbState {
  users: Record<string, User>;          // by user.id
  userByDevice: Record<string, string>; // deviceId → user.id
  matches: Record<string, MatchRecord>;
}

export class JsonFilePersistence implements PersistenceLayer {
  private state: DbState = { users: {}, userByDevice: {}, matches: {} };
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw) as DbState;
        this.state = {
          users: parsed.users ?? {},
          userByDevice: parsed.userByDevice ?? {},
          matches: parsed.matches ?? {},
        };
      } else {
        // Ensure directory exists
        const dir = path.dirname(this.filePath);
        fs.mkdirSync(dir, { recursive: true });
        this.save();
      }
    } catch (err) {
      console.error('[persistence] load failed, starting fresh', err);
      this.state = { users: {}, userByDevice: {}, matches: {} };
    }
  }

  /** Atomic write: write to temp file, then rename. */
  private save(): void {
    try {
      const tmp = this.filePath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.error('[persistence] save failed', err);
    }
  }

  private queueSave(): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => {
      this.save();
    });
    return this.writeQueue;
  }

  async upsertUser(deviceId: string, nickname: string): Promise<User> {
    let userId = this.state.userByDevice[deviceId];
    let user: User;
    if (userId && this.state.users[userId]) {
      user = this.state.users[userId]!;
      user.nickname = nickname;
      user.lastActive = Date.now();
    } else {
      userId = `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      user = {
        id: userId,
        deviceId,
        nickname,
        createdAt: Date.now(),
        lastActive: Date.now(),
        totalMatches: 0, wins: 0, losses: 0, draws: 0,
        rating: 1500,
      };
      this.state.users[userId] = user;
      this.state.userByDevice[deviceId] = userId;
    }
    await this.queueSave();
    return user;
  }

  async getUserStats(userId: string): Promise<User | null> {
    return this.state.users[userId] ?? null;
  }

  async recordMatchStart(matchId: string, config: SandboxConfig, userIds: string[]): Promise<void> {
    this.state.matches[matchId] = {
      id: matchId,
      startedAt: Date.now(),
      configJson: JSON.stringify(config),
      winnerUserId: null,
      reason: '',
      participants: userIds.map((uid, idx) => ({
        userId: uid,
        playerIdx: idx,
        finalTerritoryPct: 0,
      })),
    };
    await this.queueSave();
  }

  async recordMatchEnd(matchId: string, result: MatchResult, replay: Replay | null): Promise<void> {
    const match = this.state.matches[matchId];
    if (!match) return;
    match.finishedAt = Date.now();
    match.durationTicks = result.finishedAtTick;
    match.reason = result.reason;
    if (result.territory) {
      for (const t of result.territory) {
        const p = match.participants.find((pp) => pp.userId.includes(t.playerId) || true);
        // Note: territory.playerId is config player.id ('p0'/'p1'), not our userId.
        // Match by playerIdx through territory order — simplified для MVP.
        if (p && match.participants.indexOf(p) === match.participants.indexOf(p)) {
          // ... finalTerritoryPct will be set via participants order
        }
      }
      // Simpler: match by order
      result.territory.forEach((t, idx) => {
        if (match.participants[idx]) {
          match.participants[idx]!.finalTerritoryPct = t.pct;
        }
      });
    }
    // Winner detection через result.winnerId (config player.id like 'p0'/'p1')
    if (result.winnerId) {
      const winnerSlotIdx = result.winnerId === 'p0' ? 0 : result.winnerId === 'p1' ? 1 : -1;
      if (winnerSlotIdx >= 0 && match.participants[winnerSlotIdx]) {
        match.winnerUserId = match.participants[winnerSlotIdx]!.userId;
      }
    }
    if (replay) {
      match.replayJson = JSON.stringify(replay);
    }
    // Update user stats: wins/losses/draws + rating
    const winnerId = match.winnerUserId;
    for (const p of match.participants) {
      const user = this.state.users[p.userId];
      if (!user) continue;
      user.totalMatches++;
      user.lastActive = Date.now();
      if (winnerId == null) {
        user.draws++;
      } else if (p.userId === winnerId) {
        user.wins++;
        user.rating += 16; // simplified ELO — proper algorithm later
      } else {
        user.losses++;
        user.rating = Math.max(100, user.rating - 16);
      }
    }
    await this.queueSave();
  }

  async getRecentMatches(limit: number): Promise<MatchRecord[]> {
    const all = Object.values(this.state.matches);
    all.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
    return all.slice(0, limit);
  }

  async queryMatches(q: ReplayQuery): Promise<{ items: MatchRecord[]; total: number }> {
    const limit = Math.max(1, Math.min(100, q.limit ?? 20));
    const offset = Math.max(0, q.offset ?? 0);
    const finishedOnly = q.finishedOnly ?? true;
    let all = Object.values(this.state.matches);
    if (finishedOnly) all = all.filter((m) => m.finishedAt != null);
    if (q.since != null) all = all.filter((m) => (m.startedAt ?? 0) >= q.since!);
    if (q.winConditionKind) {
      all = all.filter((m) => {
        try {
          const cfg = JSON.parse(m.configJson) as { winCondition?: { kind?: string } };
          return cfg.winCondition?.kind === q.winConditionKind;
        } catch { return false; }
      });
    }
    all.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
    const total = all.length;
    return { items: all.slice(offset, offset + limit), total };
  }

  async getMatch(matchId: string): Promise<MatchRecord | null> {
    return this.state.matches[matchId] ?? null;
  }

  async close(): Promise<void> {
    await this.writeQueue;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createPersistence(): PersistenceLayer {
  const env = (typeof process !== 'undefined' ? process.env : {}) ?? {};
  if (env.PERSISTENCE === 'noop' || env.NODE_ENV === 'test') {
    return new NoOpPersistence();
  }
  const dataDir = env.DATA_DIR ?? path.join(process.env.HOME ?? '/tmp', '.langton-arena-data');
  const dbPath = path.join(dataDir, 'db.json');
  return new JsonFilePersistence(dbPath);
}
