// services/game-worker/src/replayLog.ts
//
// Лог инпутов матча для воспроизводимости.
// Размер: 5-15 КБ на матч (после gzip). Хранится в S3 как .lreplay файл.

import type { MatchConfig } from './match';

export interface ReplayEntry {
  tick: number;
  type?: string;
  playerId?: string;
  data?: unknown;
  events?: unknown;
}

export class ReplayLog {
  private entries: ReplayEntry[] = [];
  private readonly startedAt: number;

  constructor(private readonly config: MatchConfig) {
    this.startedAt = Date.now();
    this.entries.push({ tick: 0, type: 'match:start' });
  }

  append(entry: ReplayEntry): void {
    this.entries.push(entry);
  }

  /** Сериализовать в формат .lreplay (gzip(JSON)). См. backend §10.1. */
  serialize(_result: { winnerId: string | null; scores: Record<string, number> }): Buffer {
    // TODO:
    // const obj = { version: '1.0', match_id: this.config.matchId, ... entries, result };
    // const json = JSON.stringify(obj);
    // return gzipSync(Buffer.from(json));
    throw new Error('not implemented');
  }
}
