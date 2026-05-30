// tests/persistence.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { JsonFilePersistence, NoOpPersistence } from '../src/persistence.js';
import type { SandboxConfig, MatchResult } from '@langton/core';

const sampleConfig: SandboxConfig = {
  width: 60, height: 60, topology: 'torus',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('NoOpPersistence', () => {
  it('upsertUser returns valid user', async () => {
    const db = new NoOpPersistence();
    const u = await db.upsertUser('dev-1', 'Alice');
    expect(u.deviceId).toBe('dev-1');
    expect(u.rating).toBe(1500);
  });
  it('getUserStats returns null', async () => {
    const db = new NoOpPersistence();
    expect(await db.getUserStats('any')).toBeNull();
  });
  it('recordMatch* are no-ops without throw', async () => {
    const db = new NoOpPersistence();
    await db.recordMatchStart('m1', sampleConfig, ['u1', 'u2']);
    await db.recordMatchEnd('m1', { finished: true, winnerId: 'p0', winnerName: 'A',
      reason: 'time_expired', finishedAtTick: 300, bannerVisible: true } as MatchResult, null);
    expect(await db.getRecentMatches(10)).toEqual([]);
  });
});

describe('JsonFilePersistence', () => {
  let tmpDir: string;
  let dbPath: string;
  let db: JsonFilePersistence;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'langton-test-'));
    dbPath = path.join(tmpDir, 'db.json');
    db = new JsonFilePersistence(dbPath);
  });

  afterEach(async () => {
    await db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates DB file on first init', () => {
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('upsertUser creates new user', async () => {
    const u = await db.upsertUser('dev-1', 'Alice');
    expect(u.deviceId).toBe('dev-1');
    expect(u.nickname).toBe('Alice');
    expect(u.totalMatches).toBe(0);
    expect(u.rating).toBe(1500);
  });

  it('upsertUser идемпотентно (same deviceId → same user)', async () => {
    const u1 = await db.upsertUser('dev-1', 'Alice');
    const u2 = await db.upsertUser('dev-1', 'Alice-renamed');
    expect(u1.id).toBe(u2.id);
    expect(u2.nickname).toBe('Alice-renamed');
  });

  it('survives reload — state persists в file', async () => {
    const u = await db.upsertUser('dev-1', 'Alice');
    await db.close();
    // Re-open same file
    const db2 = new JsonFilePersistence(dbPath);
    const stored = await db2.getUserStats(u.id);
    expect(stored?.nickname).toBe('Alice');
    await db2.close();
  });

  it('recordMatchStart + recordMatchEnd tracking', async () => {
    const u1 = await db.upsertUser('dev-1', 'Alice');
    const u2 = await db.upsertUser('dev-2', 'Bob');
    await db.recordMatchStart('m1', sampleConfig, [u1.id, u2.id]);
    await db.recordMatchEnd('m1', {
      finished: true, winnerId: 'p0', winnerName: 'Alice',
      reason: 'time_expired', finishedAtTick: 300, bannerVisible: true,
      territory: [
        { playerId: 'p0', playerName: 'Alice', cells: 1800, pct: 0.50 },
        { playerId: 'p1', playerName: 'Bob', cells: 900, pct: 0.25 },
      ],
    } as MatchResult, null);

    const stats1 = await db.getUserStats(u1.id);
    expect(stats1?.totalMatches).toBe(1);
    expect(stats1?.wins).toBe(1);
    expect(stats1?.losses).toBe(0);
    expect(stats1?.rating).toBe(1516); // 1500 + 16

    const stats2 = await db.getUserStats(u2.id);
    expect(stats2?.totalMatches).toBe(1);
    expect(stats2?.losses).toBe(1);
    expect(stats2?.rating).toBe(1484); // 1500 - 16
  });

  it('draw — both players +1 draw, no rating change', async () => {
    const u1 = await db.upsertUser('dev-1', 'Alice');
    const u2 = await db.upsertUser('dev-2', 'Bob');
    await db.recordMatchStart('m1', sampleConfig, [u1.id, u2.id]);
    await db.recordMatchEnd('m1', {
      finished: true, winnerId: null, winnerName: null,
      reason: 'time_expired_tie', finishedAtTick: 300, bannerVisible: true,
    } as MatchResult, null);

    const stats1 = await db.getUserStats(u1.id);
    expect(stats1?.draws).toBe(1);
    expect(stats1?.rating).toBe(1500);
  });

  it('getRecentMatches sorted desc by startedAt', async () => {
    const u1 = await db.upsertUser('dev-1', 'Alice');
    await db.recordMatchStart('m1', sampleConfig, [u1.id]);
    await new Promise(r => setTimeout(r, 5));
    await db.recordMatchStart('m2', sampleConfig, [u1.id]);
    const recent = await db.getRecentMatches(10);
    expect(recent[0]?.id).toBe('m2');
    expect(recent[1]?.id).toBe('m1');
  });

  it('rating clamps к min 100', async () => {
    const u1 = await db.upsertUser('dev-1', 'Alice');
    const u2 = await db.upsertUser('dev-2', 'Bob');
    // Force u1 rating to low value
    u1.rating = 110;
    // Simulate loss
    await db.recordMatchStart('m1', sampleConfig, [u1.id, u2.id]);
    await db.recordMatchEnd('m1', {
      finished: true, winnerId: 'p1', winnerName: 'Bob',
      reason: 'time_expired', finishedAtTick: 300, bannerVisible: true,
    } as MatchResult, null);
    const stats = await db.getUserStats(u1.id);
    expect(stats?.rating).toBeGreaterThanOrEqual(100);
  });
});
