// src/lib/resumeToken.ts
//
// Stage 8 Day 13 — persist resumeToken для reconnect.
//
// Хранится в sessionStorage (не localStorage) потому что:
//   - Закрытие вкладки = новая сессия = новый матч (no stale resume)
//   - sessionStorage очищается при close tab — клиент не "застрянет" с
//     orphan token который сервер уже забыл
//
// Keyed по roomCode чтобы одновременные комнаты не конфликтовали.

const STORAGE_KEY_PREFIX = 'langton.resumeToken:';

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* swallow — private mode / quota */
  }
}

function safeRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* swallow */
  }
}

export function getResumeToken(roomCode: string): string | null {
  return safeGet(STORAGE_KEY_PREFIX + roomCode);
}

export function setResumeToken(roomCode: string, token: string): void {
  safeSet(STORAGE_KEY_PREFIX + roomCode, token);
}

export function clearResumeToken(roomCode: string): void {
  safeRemove(STORAGE_KEY_PREFIX + roomCode);
}
