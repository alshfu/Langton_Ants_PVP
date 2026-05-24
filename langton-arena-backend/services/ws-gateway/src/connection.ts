// services/ws-gateway/src/connection.ts
//
// Жизненный цикл одного клиентского соединения:
// 1. Open → ждать auth:hello (timeout 5 сек, иначе close)
// 2. Validate JWT, регистрировать в Redis ws:conn:{user_id}
// 3. Heartbeat: каждые WS_HEARTBEAT_INTERVAL_MS отправлять ping; если pong не пришёл — close
// 4. Все входящие → router.ts
// 5. Close → удалить из Redis, отписать от каналов

import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

export interface Client {
  ws: WebSocket;
  userId: string | null;
  subscribedChannels: Set<string>;
  lastSeq: number;
  lastPongAt: number;
  msgCountInSecond: number;     // для rate limit
}

export async function handleConnection(_ws: WebSocket, _req: IncomingMessage): Promise<void> {
  // TODO:
  // 1. Создать Client
  // 2. Установить authTimeout: setTimeout(close, 5000)
  // 3. ws.on('message', → router.route(client, msg))
  // 4. ws.on('close', → cleanup: Redis del, unsubscribe)
  // 5. ws.on('pong', → client.lastPongAt = Date.now())
  // 6. setInterval(ping, WS_HEARTBEAT_INTERVAL_MS)
}
