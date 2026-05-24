// services/ws-gateway/src/channels/pubsub.ts
//
// Redis pub/sub для inter-process коммуникации между WS Gateway / Game Workers / Matchmaker.

import Redis from 'ioredis';
import { getLocalSubscribers } from './channelManager';

const subscriber = new Redis({ host: process.env.REDIS_HOST, port: parseInt(process.env.REDIS_PORT || '6379', 10) });
const publisher  = new Redis({ host: process.env.REDIS_HOST, port: parseInt(process.env.REDIS_PORT || '6379', 10) });

export async function startPubsub(): Promise<void> {
  // TODO: psubscribe + диспатч в getLocalSubscribers
  subscriber.on('pmessage', (_pattern, channel, message) => { void channel; void message; });
}

export async function publish(channel: string, message: Uint8Array): Promise<void> {
  await publisher.publish(channel, Buffer.from(message).toString('base64'));
}
