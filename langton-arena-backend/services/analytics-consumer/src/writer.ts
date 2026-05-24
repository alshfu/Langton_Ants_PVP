// services/analytics-consumer/src/writer.ts
//
// Запись batch в ClickHouse.

import { createClient } from '@clickhouse/client';

const ch = createClient({
  host: `http://${process.env.CLICKHOUSE_HOST}:${process.env.CLICKHOUSE_PORT}`,
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DATABASE || 'arena_analytics',
});

export async function writeBatch(events: unknown[]): Promise<void> {
  if (events.length === 0) return;
  try {
    await ch.insert({
      table: 'match_events',
      values: events,
      format: 'JSONEachRow',
    });
  } catch (err) {
    console.error('ClickHouse insert failed', err);
    // TODO: retry с backoff, после N попыток — DLQ
  }
}
