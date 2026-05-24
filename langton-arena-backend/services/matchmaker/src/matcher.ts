// services/matchmaker/src/matcher.ts
//
// Главная логика подбора. Запускается каждые MM_TICK_INTERVAL_MS.

import { getQueue, removeFromQueue, type QueueEntry } from './queue';
import { getSrWindow } from './srWindow';

export async function tryMatch(): Promise<void> {
  // Для каждой пары (region, mode) — пытаемся составить матчи.
  // TODO: получить все ключи активных очередей; для каждой:
  //   const q = getQueue(region, mode);
  //   if (q.length < 2) continue;
  //   const groups = findGroups(q);
  //   for (const group of groups) createLobby(group);
}

/**
 * Жадный алгоритм: проходим по очереди от старейшего, для каждого собираем компанию
 * в его SR-окне до target размера. Если не хватает — следующий итерируем.
 */
function findGroups(_q: readonly QueueEntry[]): QueueEntry[][] {
  // TODO
  return [];
}

async function createLobby(group: QueueEntry[]): Promise<void> {
  // TODO:
  // 1. Снять всех из очереди (removeFromQueue)
  // 2. Создать lobby_id (uuid)
  // 3. Publish create_lobby:{region} с participants
  // 4. WS Gateway отправит mm:match_found каждому
  void group;
}

// Используется в findGroups
void getSrWindow;
