// services/matchmaker/src/server.ts
//
// Главный процесс matchmaker:
// 1. Connect to Redis
// 2. Subscribe to mm:join / mm:leave / mm:accept каналы от WS Gateway
// 3. setInterval(tryMatch, MM_TICK_INTERVAL_MS)
// 4. Когда match сформирован → publish create_match в Redis (для Game Worker)
//    + push в Redis lobbyCreated:{lobbyId} для WS Gateway

import { tryMatch } from './matcher';

export async function startMatchmaker(): Promise<void> {
  const INTERVAL = parseInt(process.env.MM_TICK_INTERVAL_MS || '500', 10);
  console.log(`Matchmaker starting, tick interval ${INTERVAL}ms`);

  // TODO:
  // 1. Connect Redis
  // 2. Subscribe pubsub channels
  // 3. setInterval(() => tryMatch(...), INTERVAL)

  setInterval(() => { void tryMatch(); }, INTERVAL);
}
