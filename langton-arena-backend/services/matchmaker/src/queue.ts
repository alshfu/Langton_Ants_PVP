// services/matchmaker/src/queue.ts
//
// In-memory очереди + sync с Redis.
// Каждая очередь — массив игроков сортированный по joinedAt (FIFO).
// Параллельно те же игроки лежат в Redis SORTED SET (score=SR) для других сервисов.

export interface QueueEntry {
  userId: string;
  sr: number;
  prefMatchSize: number | null;
  joinedAt: number;
  mode: string;
  region: string;
}

const queues = new Map<string, QueueEntry[]>();    // key: `${region}:${mode}`

export function addToQueue(entry: QueueEntry): void {
  const key = `${entry.region}:${entry.mode}`;
  let q = queues.get(key);
  if (!q) { q = []; queues.set(key, q); }
  q.push(entry);
  // TODO: ZADD mm:queue:{region}:{mode} entry.sr entry.userId
}

export function removeFromQueue(userId: string, region: string, mode: string): void {
  const key = `${region}:${mode}`;
  const q = queues.get(key);
  if (!q) return;
  const idx = q.findIndex((e) => e.userId === userId);
  if (idx >= 0) q.splice(idx, 1);
  // TODO: ZREM
}

export function getQueue(region: string, mode: string): readonly QueueEntry[] {
  return queues.get(`${region}:${mode}`) || [];
}
