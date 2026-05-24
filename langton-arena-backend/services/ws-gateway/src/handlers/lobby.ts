// services/ws-gateway/src/handlers/lobby.ts
//
// Обработка lobby:* сообщений.
// Подробнее: docs/backend-architecture.md §4.3.

import type { Client } from '../connection';

export async function handleLobby(_client: Client, _msg: unknown): Promise<void> {
  // TODO:
  // 1. Сузить тип msg по полю type
  // 2. Выполнить бизнес-логику
  // 3. Отправить ответ клиенту через client.ws.send(encodeMessage(...))
}
