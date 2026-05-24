// services/ws-gateway/src/channels/channelManager.ts
//
// Управляет подписками клиентов на channels (виртуальные каналы поверх Redis pub/sub).

import type { Client } from '../connection';

const localSubscribers = new Map<string, Set<Client>>();

export async function subscribe(client: Client, channel: string): Promise<void> {
  client.subscribedChannels.add(channel);
  let set = localSubscribers.get(channel);
  if (!set) { set = new Set(); localSubscribers.set(channel, set); }
  set.add(client);
}

export async function unsubscribe(client: Client, channel: string): Promise<void> {
  client.subscribedChannels.delete(channel);
  const set = localSubscribers.get(channel);
  if (set) { set.delete(client); if (set.size === 0) localSubscribers.delete(channel); }
}

export function getLocalSubscribers(channel: string): ReadonlySet<Client> {
  return localSubscribers.get(channel) || new Set();
}
