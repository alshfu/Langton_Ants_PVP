// services/game-worker/src/match.ts
//
// Один игровой матч: от создания до сохранения результатов.
// Состояние держится В ПАМЯТИ — никаких роундтрипов в БД на каждый тик.

import { makeLangtonState, type SimState } from '@langton/core';
import { startTickLoop, stopTickLoop } from './tickLoop';
import { ReplayLog } from './replayLog';

export interface MatchConfig {
  matchId: string;
  mode: string;
  region: string;
  seed: number;
  fieldW: number;
  fieldH: number;
  players: Array<{
    userId: string;
    slotIndex: number;
    colorId: number;
    squadRules: string[];
  }>;
}

export class Match {
  readonly id: string;
  readonly sim: SimState;
  readonly replayLog: ReplayLog;
  private tickHandle: NodeJS.Timeout | null = null;

  constructor(private readonly config: MatchConfig) {
    this.id = config.matchId;
    // TODO: построить ants из config.players × squadRules
    this.sim = makeLangtonState({
      w: config.fieldW, h: config.fieldH, seed: config.seed,
      ants: [], // TODO
    });
    this.replayLog = new ReplayLog(config);
  }

  start(): void {
    this.tickHandle = startTickLoop(this);
  }

  /** Применить input от клиента (вызывается из WS Gateway через Redis pubsub). */
  applyInput(_userId: string, _input: unknown): void {
    // TODO: валидировать что user — участник матча, добавить input в очередь, replayLog.append()
  }

  async finalize(_reason: 'time_up' | 'last_standing' | 'forfeit'): Promise<void> {
    if (this.tickHandle) stopTickLoop(this.tickHandle);
    this.tickHandle = null;
    // TODO:
    // 1. Посчитать финальные scores
    // 2. UPDATE matches + INSERT match_participants в Postgres
    // 3. Сохранить replayLog как .lreplay в S3
    // 4. Применить SR-изменения (UPDATE user_progress)
    // 5. Опубликовать match:end в Redis для WS Gateway
    // 6. Очистить из локальной Map
  }
}
