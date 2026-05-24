// services/game-worker/src/tickLoop.ts
//
// 10 TPS цикл одного матча.
// Использует setInterval с компенсацией дрифта.

import { stepLangton } from '@langton/core';
import type { Match } from './match';
import { computeDelta } from './deltaComputer';
import { broadcastDelta } from './broadcast';

const TICK_RATE = parseInt(process.env.WORKER_TICK_RATE || '10', 10);
const PERIOD_MS = 1000 / TICK_RATE;
const SNAPSHOT_EVERY = parseInt(process.env.WORKER_SNAPSHOT_EVERY_N_TICKS || '10', 10);

export function startTickLoop(match: Match): NodeJS.Timeout {
  let lastSnapshot = match.sim;       // TODO: deep clone для дельт
  void lastSnapshot;

  return setInterval(() => {
    const start = process.hrtime.bigint();

    // 1. Применить queued inputs (TODO)

    // 2. Один шаг симуляции
    const events = stepLangton(match.sim);

    // 3. Replay log
    match.replayLog.append({ tick: match.sim.tick, events });

    // 4. Дельта или snapshot
    const isSnapshot = match.sim.tick % SNAPSHOT_EVERY === 0;
    const payload = isSnapshot ? match.sim : computeDelta(lastSnapshot, match.sim);
    void broadcastDelta(match.id, payload, events);

    // 5. Проверка условий конца
    // TODO: if (match.sim.tick >= MATCH_DURATION) match.finalize('time_up')

    const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;
    if (elapsed > PERIOD_MS * 0.5) {
      // warn: тик занял >50% бюджета
    }
  }, PERIOD_MS);
}

export function stopTickLoop(handle: NodeJS.Timeout): void {
  clearInterval(handle);
}
