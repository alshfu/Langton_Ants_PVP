// tests/replaysApi.test.ts
//
// Stage 9.5: HTTP API endpoints для public replays browser.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MvpServer } from '../src/server.js';
import { JsonFilePersistence } from '../src/persistence.js';
import type { SandboxConfig, MatchResult, Replay } from '@langton/core';

const sampleConfig = (override: Partial<SandboxConfig> = {}): SandboxConfig => ({
  width: 40, height: 40, topology: 'torus',
  winCondition: { kind: 'territory', threshold: 50 } as unknown as SandboxConfig['winCondition'],
  ...override,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

const sampleResult = (winnerId: 'p0' | 'p1' | null = 'p0'): MatchResult => ({
  finished: true,
  winnerId,
  winnerName: winnerId === 'p0' ? 'Alice' : winnerId === 'p1' ? 'Bob' : null,
  reason: winnerId == null ? 'time_expired' : 'time_expired',
  finishedAtTick: 300,
  bannerVisible: true,
  territory: [
    { playerId: 'p0', pct: 60, cells: 600 },
    { playerId: 'p1', pct: 40, cells: 400 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as any,
});

const sampleReplay = (): Replay => ({
  version: 1,
  metadata: {
    id: 'r1',
    name: 'Sample',
    createdAt: Date.now(),
    durationTicks: 300,
    deployCount: 10,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: sampleConfig() as any,
  deployTimeline: [
    { tick: 5, playerIdx: 0, x: 10, y: 10 },
    { tick: 7, playerIdx: 1, x: 20, y: 20 },
  ],
});

describe('Replays REST API', () => {
  let server: MvpServer;
  let url: string;
  let tmpDir: string;
  let db: JsonFilePersistence;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'replays-api-test-'));
    db = new JsonFilePersistence(path.join(tmpDir, 'db.json'));
    server = new MvpServer({
      port: 0,
      logger: () => { /* silent */ },
      persistence: db,
      matchCountdownMs: 30,
      matchTickIntervalMs: 5,
    });
    const { host, port } = await server.start();
    url = `http://${host}:${port}`;
  });

  afterEach(async () => {
    await server.stop();
    await db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET /api/replays returns empty list initially', async () => {
    const res = await fetch(`${url}/api/replays`);
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json() as any;
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it('GET /api/replays lists finished matches', async () => {
    const u1 = await db.upsertUser('dev-1', 'Alice');
    const u2 = await db.upsertUser('dev-2', 'Bob');
    await db.recordMatchStart('m1', sampleConfig(), [u1.id, u2.id]);
    await db.recordMatchEnd('m1', sampleResult('p0'), sampleReplay());

    const res = await fetch(`${url}/api/replays`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json() as any;
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].matchId).toBe('m1');
    expect(body.items[0].winnerNickname).toBe('Alice');
    expect(body.items[0].winConditionKind).toBe('territory');
    expect(body.items[0].participants).toHaveLength(2);
    expect(body.items[0].participants[0].nickname).toBe('Alice');
    expect(body.items[0].participants[0].territoryPct).toBe(60);
  });

  it('GET /api/replays?limit&offset paginates', async () => {
    const u1 = await db.upsertUser('dev-1', 'Alice');
    const u2 = await db.upsertUser('dev-2', 'Bob');
    for (let i = 0; i < 5; i++) {
      const mid = `m${i}`;
      await db.recordMatchStart(mid, sampleConfig(), [u1.id, u2.id]);
      await db.recordMatchEnd(mid, sampleResult('p0'), sampleReplay());
      await new Promise((r) => setTimeout(r, 2)); // stagger startedAt
    }
    const res = await fetch(`${url}/api/replays?limit=2&offset=1`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json() as any;
    expect(body.total).toBe(5);
    expect(body.items).toHaveLength(2);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(1);
  });

  it('GET /api/replays?kind filters by winCondition', async () => {
    const u1 = await db.upsertUser('dev-1', 'Alice');
    await db.recordMatchStart('mTerr', sampleConfig({
      winCondition: { kind: 'territory', threshold: 50 } as unknown as SandboxConfig['winCondition'],
    }), [u1.id]);
    await db.recordMatchEnd('mTerr', sampleResult('p0'), sampleReplay());
    await db.recordMatchStart('mHold', sampleConfig({
      winCondition: { kind: 'hold_majority', threshold: 50, holdTicks: 100 } as unknown as SandboxConfig['winCondition'],
    }), [u1.id]);
    await db.recordMatchEnd('mHold', sampleResult('p0'), sampleReplay());

    const res = await fetch(`${url}/api/replays?kind=hold_majority`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json() as any;
    expect(body.items).toHaveLength(1);
    expect(body.items[0].matchId).toBe('mHold');
  });

  it('GET /api/replays?finishedOnly=false includes unfinished', async () => {
    const u1 = await db.upsertUser('dev-1', 'Alice');
    await db.recordMatchStart('mLive', sampleConfig(), [u1.id]);
    // No recordMatchEnd
    const r1 = await fetch(`${url}/api/replays`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b1 = await r1.json() as any;
    expect(b1.total).toBe(0);
    const r2 = await fetch(`${url}/api/replays?finishedOnly=false`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b2 = await r2.json() as any;
    expect(b2.total).toBe(1);
  });

  it('GET /api/replays/:matchId returns detail with config + replay', async () => {
    const u1 = await db.upsertUser('dev-1', 'Alice');
    await db.recordMatchStart('m1', sampleConfig(), [u1.id]);
    await db.recordMatchEnd('m1', sampleResult('p0'), sampleReplay());

    const res = await fetch(`${url}/api/replays/m1`);
    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json() as any;
    expect(body.matchId).toBe('m1');
    expect(body.winnerNickname).toBe('Alice');
    expect(body.config).toBeTruthy();
    expect(body.config.width).toBe(40);
    expect(body.replay).toBeTruthy();
    expect(body.replay.deployTimeline).toHaveLength(2);
  });

  it('GET /api/replays/:matchId 404 unknown id', async () => {
    const res = await fetch(`${url}/api/replays/non-existent`);
    expect(res.status).toBe(404);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json() as any;
    expect(body.error).toBe('not_found');
  });

  it('CORS preflight OPTIONS returns 204 + allow-origin', async () => {
    const res = await fetch(`${url}/api/replays`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('non-GET method on /api/replays → 405', async () => {
    const res = await fetch(`${url}/api/replays`, { method: 'POST' });
    expect(res.status).toBe(405);
  });
});
