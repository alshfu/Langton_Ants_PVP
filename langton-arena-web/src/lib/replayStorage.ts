// src/lib/replayStorage.ts
//
// Управление сохранёнными replays в localStorage.
//
// Схема ключей:
//   `langton.replays.index` → ReplayMetadata[] (быстрый list)
//   `langton.replay.<id>`   → Replay (полный объект)
//
// Это оптимизация: метаданные нужны для UI списка (часто читаются),
// полный replay — только при playback (редко). Не держим всё в одном
// массиве чтобы не парсить лишнее.

import type { Replay, ReplayMetadata } from '@core/contract/replay';

const STORAGE_KEY_INDEX = 'langton.replays.index';
const STORAGE_KEY_PREFIX = 'langton.replay.';
const REPLAYS_MAX = 30;

/** Сгенерировать уникальный ID. */
export function generateReplayId(): string {
  return `replay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Список всех сохранённых replays (только metadata). */
export function listReplays(): ReplayMetadata[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INDEX);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Сохранить replay. При превышении лимита — FIFO удалить самый старый. */
export function saveReplay(replay: Replay): { saved: boolean; evictedId?: string } {
  try {
    const index = listReplays();

    // FIFO: если уже лимит — удалить самого старого
    let evictedId: string | undefined;
    if (index.length >= REPLAYS_MAX) {
      // Сортируем по createdAt ascending, первый — самый старый
      const sorted = [...index].sort((a, b) => a.createdAt - b.createdAt);
      const oldest = sorted[0]!;
      evictedId = oldest.id;
      localStorage.removeItem(STORAGE_KEY_PREFIX + oldest.id);
    }

    // Сохраняем full replay
    localStorage.setItem(STORAGE_KEY_PREFIX + replay.metadata.id, JSON.stringify(replay));

    // Обновляем index (без evicted + new metadata)
    const nextIndex = index
      .filter((m) => m.id !== evictedId)
      .concat([replay.metadata]);
    localStorage.setItem(STORAGE_KEY_INDEX, JSON.stringify(nextIndex));

    return { saved: true, evictedId };
  } catch {
    return { saved: false };
  }
}

/** Загрузить полный replay по ID. */
export function loadReplay(id: string): Replay | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Минимальная валидация
    if (parsed?.version !== 1) return null;
    if (!parsed.metadata || !parsed.config || !Array.isArray(parsed.deployTimeline)) {
      return null;
    }
    return parsed as Replay;
  } catch {
    return null;
  }
}

/** Удалить replay (full + из index). */
export function deleteReplay(id: string): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
    const index = listReplays().filter((m) => m.id !== id);
    localStorage.setItem(STORAGE_KEY_INDEX, JSON.stringify(index));
    return true;
  } catch {
    return false;
  }
}

/** Очистить ВСЕ replays. Используется для тестов или reset settings. */
export function clearAllReplays(): void {
  try {
    const index = listReplays();
    for (const m of index) {
      localStorage.removeItem(STORAGE_KEY_PREFIX + m.id);
    }
    localStorage.removeItem(STORAGE_KEY_INDEX);
  } catch {
    /* noop */
  }
}

/** Лимит хранения — для UI «5/30 saved». */
export const REPLAYS_LIMIT = REPLAYS_MAX;
