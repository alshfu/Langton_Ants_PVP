// services/api-gateway/src/repositories/matchRepo.ts
//
// SQL для таблиц matches + match_participants.

import type { Pool } from 'pg';

export class MatchRepo {
  constructor(private readonly pool: Pool) {}

  /** Создать запись матча (вызывается Game Worker'ом через RPC или прямой SQL). */
  async createMatch(_data: {
    mode: string;
    region: string;
    seed: number;
    fieldW: number;
    fieldH: number;
    playerCount: number;
    serverVersion: string;
  }): Promise<string /* match_id */> {
    // TODO
    throw new Error('not implemented');
  }

  /** Финализировать матч. Идёт после окончания. */
  async finalizeMatch(_matchId: string, _data: {
    winnerId: string | null;
    durationTicks: number;
    replayS3Key: string;
    participants: Array<{
      userId: string;
      finalPlace: number;
      cellsCaptured: number;
      kills: number;
      deaths: number;
      srBefore: number;
      srAfter: number;
      xpGained: number;
      forfeited: boolean;
      disconnected: boolean;
      squadRules: string[];
    }>;
  }): Promise<void> {
    // TODO: транзакция: UPDATE matches; INSERT match_participants...;
  }

  /** История матчей игрока для профиля. */
  async getPlayerHistory(_userId: string, _limit: number, _offset: number): Promise<unknown[]> {
    // TODO
    return [];
  }

  /** Полная информация о матче для replay-страницы. */
  async getMatchDetails(_matchId: string): Promise<unknown | null> {
    // TODO
    return null;
  }
}
