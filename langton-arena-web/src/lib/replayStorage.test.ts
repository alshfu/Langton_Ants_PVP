// src/lib/replayStorage.test.ts

import { beforeEach, describe, it, expect } from 'vitest';
import {
  saveReplay, loadReplay, listReplays, deleteReplay, clearAllReplays,
  generateReplayId, REPLAYS_LIMIT,
} from './replayStorage';
import type { Replay } from '@core/contract/replay';
import type { SandboxConfig } from '@core/contract/state';

// Minimal SandboxConfig stub для тестов
function stubConfig(): SandboxConfig {
  return {} as SandboxConfig;
}

function makeReplay(overrides: Partial<Replay['metadata']> = {}): Replay {
  const id = overrides.id ?? generateReplayId();
  return {
    version: 1,
    metadata: {
      id,
      name: 'Test replay',
      createdAt: Date.now(),
      durationTicks: 100,
      deployCount: 5,
      ...overrides,
    },
    config: stubConfig(),
    deployTimeline: [
      { tick: 10, playerIdx: 0, x: 5, y: 5 },
      { tick: 20, playerIdx: 1, x: 8, y: 8 },
    ],
  };
}

describe('replayStorage', () => {
  beforeEach(() => {
    clearAllReplays();
  });

  it('list возвращает пустой массив когда ничего нет', () => {
    expect(listReplays()).toEqual([]);
  });

  it('save → load возвращает тот же replay', () => {
    const replay = makeReplay({ name: 'My first' });
    const result = saveReplay(replay);
    expect(result.saved).toBe(true);

    const loaded = loadReplay(replay.metadata.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.metadata.name).toBe('My first');
    expect(loaded!.deployTimeline).toHaveLength(2);
  });

  it('list возвращает metadata всех сохранённых', () => {
    saveReplay(makeReplay({ name: 'A' }));
    saveReplay(makeReplay({ name: 'B' }));
    saveReplay(makeReplay({ name: 'C' }));

    const list = listReplays();
    expect(list).toHaveLength(3);
    expect(list.map((m) => m.name).sort()).toEqual(['A', 'B', 'C']);
  });

  it('delete удаляет replay из index + storage', () => {
    const replay = makeReplay({ name: 'Doomed' });
    saveReplay(replay);
    expect(listReplays()).toHaveLength(1);

    deleteReplay(replay.metadata.id);
    expect(listReplays()).toHaveLength(0);
    expect(loadReplay(replay.metadata.id)).toBeNull();
  });

  it('FIFO evicts oldest при превышении лимита', () => {
    // Сохраняем REPLAYS_LIMIT + 2 штук с возрастающими createdAt
    const ids: string[] = [];
    for (let i = 0; i < REPLAYS_LIMIT + 2; i++) {
      const id = `replay-${1000 + i}-test`;
      ids.push(id);
      saveReplay(makeReplay({ id, createdAt: 1000 + i, name: `r${i}` }));
    }

    const list = listReplays();
    expect(list).toHaveLength(REPLAYS_LIMIT);

    // Первые два (самые старые) должны быть удалены
    expect(loadReplay(ids[0]!)).toBeNull();
    expect(loadReplay(ids[1]!)).toBeNull();
    // Последний должен быть на месте
    expect(loadReplay(ids[ids.length - 1]!)).not.toBeNull();
  });

  it('загрузка несуществующего возвращает null', () => {
    expect(loadReplay('non-existent-id')).toBeNull();
  });

  it('повреждённый JSON в localStorage не крашит', () => {
    localStorage.setItem('langton.replays.index', '{not valid json');
    expect(listReplays()).toEqual([]);

    localStorage.setItem('langton.replay.bad', 'not json');
    expect(loadReplay('bad')).toBeNull();
  });

  it('replay с неправильной версией не загружается', () => {
    const bad = { version: 999, metadata: {}, config: {}, deployTimeline: [] };
    localStorage.setItem('langton.replay.future', JSON.stringify(bad));
    expect(loadReplay('future')).toBeNull();
  });

  it('generateReplayId возвращает уникальные ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateReplayId());
    expect(ids.size).toBe(100); // все уникальны
  });

  it('clearAllReplays удаляет всё', () => {
    saveReplay(makeReplay({ name: 'A' }));
    saveReplay(makeReplay({ name: 'B' }));
    expect(listReplays()).toHaveLength(2);

    clearAllReplays();
    expect(listReplays()).toHaveLength(0);
  });
});
