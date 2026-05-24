// services/game-worker/src/worker.ts
//
// Главный процесс Game Worker:
// 1. Регистрируется в Redis (game_workers:{worker_id} с TTL)
// 2. Подписывается на канал create_match:{region} от Matchmaker
// 3. Хранит Map<matchId, MatchInstance> локально
// 4. На каждый create — создаёт новый MatchInstance, кладёт в map
// 5. Каждый MatchInstance имеет свой setInterval(tick, 100)

import { Match } from './match';

const activeMatches = new Map<string, Match>();
const WORKER_ID = `worker-${Math.random().toString(36).slice(2, 10)}`;
const MAX_MATCHES = parseInt(process.env.WORKER_MAX_MATCHES || '50', 10);

export async function startWorker(): Promise<void> {
  console.log(`Game worker ${WORKER_ID} starting, max=${MAX_MATCHES} matches`);

  // TODO:
  // 1. Connect to Redis
  // 2. Heartbeat: SET game_workers:{WORKER_ID} { current: N } EX 30 раз в 20 сек
  // 3. SUBSCRIBE create_match:{region} → создавать new Match()
  // 4. Graceful shutdown: SIGTERM → дождаться окончания всех матчей, потом exit
  void activeMatches; void MAX_MATCHES;
}
