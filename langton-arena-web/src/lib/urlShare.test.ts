// src/lib/urlShare.test.ts

import { describe, it, expect } from 'vitest';
import LZString from 'lz-string';
import {
  encodePresetForUrl, encodeReplayForUrl, decodeFromUrl,
  parseJsonFile, URL_FORMAT_VERSION,
} from './urlShare';
import type { SandboxConfig } from '@core/contract/state';
import type { Replay } from '@core/contract/replay';

function stubConfig(): SandboxConfig {
  // Минимально валидный config — что нужно для parseJsonFile
  return {
    players: [{ id: 'p0', name: 'A', color: '#FF0000', ants: [] }],
    width: 60,
    height: 60,
  } as any;
}

function stubReplay(): Replay {
  return {
    version: 1,
    metadata: {
      id: 'r1', name: 'Test', createdAt: 100,
      durationTicks: 500, deployCount: 3,
    },
    config: stubConfig(),
    deployTimeline: [
      { tick: 10, playerIdx: 0, x: 5, y: 5 },
      { tick: 50, playerIdx: 0, x: 10, y: 10 },
      { tick: 100, playerIdx: 0, x: 15, y: 15 },
    ],
  };
}

describe('encodePresetForUrl / decodeFromUrl roundtrip', () => {
  it('preset кодируется и декодируется обратно', () => {
    const cfg = stubConfig();
    const encoded = encodePresetForUrl(cfg);
    expect(encoded.length).toBeGreaterThan(0);

    const result = decodeFromUrl(encoded);
    expect(result.ok).toBe(true);
    expect(result.kind).toBe('preset');
    expect((result.data as SandboxConfig).width).toBe(60);
  });

  it('replay кодируется и декодируется обратно', () => {
    const r = stubReplay();
    const encoded = encodeReplayForUrl(r);
    const result = decodeFromUrl(encoded);

    expect(result.ok).toBe(true);
    expect(result.kind).toBe('replay');
    const decoded = result.data as Replay;
    expect(decoded.metadata.name).toBe('Test');
    expect(decoded.deployTimeline).toHaveLength(3);
    expect(decoded.deployTimeline[0]).toEqual({ tick: 10, playerIdx: 0, x: 5, y: 5 });
  });

  it('encoded строка URL-safe для href (без пробелов и /)', () => {
    const encoded = encodePresetForUrl(stubConfig());
    expect(encoded).not.toContain(' ');
    expect(encoded).not.toContain('/');
    // `+` допустим в encoded URI component lz-string — не критично для URL
  });

  it('compression работает на больших payloads', () => {
    // Делаем большой config с повторяющимися паттернами
    const cfg = stubConfig();
    (cfg as any).players = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`, name: `Player${i}`, color: '#FF0000',
      ants: Array.from({ length: 20 }, (_, j) => ({
        id: `ant-${i}-${j}`, x: j, y: j, dir: 0, rule: 'RL', hp: 3,
      })),
    }));
    const json = JSON.stringify({ kind: 'preset', version: URL_FORMAT_VERSION, data: cfg });
    const encoded = encodePresetForUrl(cfg);
    // С большим JSON lz-string должен сжимать заметно
    expect(encoded.length).toBeLessThan(json.length);
  });
});

describe('decodeFromUrl error handling', () => {
  it('пустая строка → reason "Empty payload"', () => {
    const result = decodeFromUrl('');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Empty');
  });

  it('случайный мусор → reason "Invalid encoded data"', () => {
    const result = decodeFromUrl('!@#$%^&*()_+-=garbage');
    expect(result.ok).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('валидный lz-string но не JSON → reason', () => {
    // Закодируем "просто строку"
    const garbage = encodePresetForUrl('not an object' as any);
    const result = decodeFromUrl(garbage);
    // "not an object" — это string, не object. parseJSON success, но дальше
    // структура не похожа на SharedPayload
    expect(result.ok).toBe(false);
  });

  it('неправильная версия → отказ', () => {
    // Захардкодим payload с version 999
    const badPayload = { kind: 'preset', version: 999, data: stubConfig() };
    const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(badPayload));
    const result = decodeFromUrl(encoded);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('not supported');
  });
});

describe('parseJsonFile', () => {
  it('валидный preset JSON → kind=preset', () => {
    const text = JSON.stringify(stubConfig());
    const r = parseJsonFile(text);
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('preset');
  });

  it('валидный replay JSON → kind=replay', () => {
    const text = JSON.stringify(stubReplay());
    const r = parseJsonFile(text);
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('replay');
  });

  it('невалидный JSON → ok=false', () => {
    const r = parseJsonFile('{not json');
    expect(r.ok).toBe(false);
  });

  it('JSON но не preset/replay → ok=false', () => {
    const r = parseJsonFile(JSON.stringify({ foo: 'bar' }));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('Unrecognized');
  });

  it('replay с неправильной версией → ok=false', () => {
    const bad = { ...stubReplay(), version: 999 };
    const r = parseJsonFile(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('not supported');
  });
});

describe('URL compactness for large replays', () => {
  it('replay с 1000 deploys помещается в разумный URL', () => {
    const replay = stubReplay();
    // Раздуем timeline
    replay.deployTimeline = [];
    for (let i = 0; i < 1000; i++) {
      replay.deployTimeline.push({ tick: i * 5, playerIdx: i % 4, x: i % 60, y: i % 40 });
    }
    replay.metadata.deployCount = 1000;
    const encoded = encodeReplayForUrl(replay);
    // Должно поместиться в URL Chrome (32K)
    expect(encoded.length).toBeLessThan(32000);
    // И корректно декодироваться
    const back = decodeFromUrl(encoded);
    expect(back.ok).toBe(true);
    expect((back.data as Replay).deployTimeline).toHaveLength(1000);
  });
});
