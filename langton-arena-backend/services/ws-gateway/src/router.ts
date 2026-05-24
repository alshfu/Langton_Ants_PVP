// services/ws-gateway/src/router.ts
//
// Маршрутизирует входящие сообщения в соответствующий handler по type.
// Перед вызовом handler — валидация через validateMessage из @langton/core.

import { decodeMessage, validateMessage } from '@langton/core';
import type { Client } from './connection';

import { handleAuth } from './handlers/auth';
import { handleMatchmaking } from './handlers/matchmaking';
import { handleLobby } from './handlers/lobby';
import { handleMatch } from './handlers/match';
import { handlePing } from './handlers/ping';

export async function route(client: Client, raw: Buffer): Promise<void> {
  let msg: unknown;
  try { msg = decodeMessage(raw); }
  catch { return; /* битый MessagePack — игнорируем */ }

  if (!validateMessage(msg)) {
    // policy violation: закрыть соединение
    client.ws.close(1008, 'invalid message');
    return;
  }

  const type = (msg as { type: string }).type;
  // Дальше — диспатч по namespace.
  if (type.startsWith('auth:'))    return handleAuth(client, msg);
  if (type.startsWith('mm:'))      return handleMatchmaking(client, msg);
  if (type.startsWith('lobby:'))   return handleLobby(client, msg);
  if (type.startsWith('match:'))   return handleMatch(client, msg);
  if (type === 'ping')             return handlePing(client);
}
