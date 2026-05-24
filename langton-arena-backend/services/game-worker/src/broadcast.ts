// services/game-worker/src/broadcast.ts
//
// Рассылка дельт/snapshots через Redis pub/sub.
// WS Gateway подписан на match:{matchId} → пересылает клиентам.

import Redis from 'ioredis';
import { encodeMessage } from '@langton/core';
import type { MatchDelta } from './deltaComputer';

const publisher = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
});

export async function broadcastDelta(matchId: string, delta: MatchDelta | unknown, _events: unknown): Promise<void> {
  const msg = encodeMessage({
    type: 'match:tick',
    seq: 0,
    ts: Date.now(),
    payload: { matchId, tick: 0, ...(delta as object) },
  } as never);
  await publisher.publish(`match:${matchId}`, Buffer.from(msg).toString('base64'));
}
