// src/lib/storage.ts
//
// Обёртка над localStorage с try/catch + версионированием.
// Если localStorage недоступен (SSR, private mode) — graceful fallback в in-memory Map.

const PREFIX = 'langton.';
const SCHEMA_VERSION = 1;

interface Envelope<T> {
  v: number;
  data: T;
  savedAt: number;
}

/** Fallback на in-memory Map когда localStorage не доступен. */
const memory = new Map<string, string>();

function rawGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch { /* private mode etc */ }
  return memory.get(key) ?? null;
}

function rawSet(key: string, value: string): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return true;
    }
  } catch { /* QuotaExceeded etc */ }
  memory.set(key, value);
  return false;
}

function rawRemove(key: string): void {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch { /* ignore */ }
  memory.delete(key);
}

/**
 * Прочитать значение. Возвращает null если ключ отсутствует, JSON битый,
 * или версия схемы устарела.
 */
export function load<T>(key: string): T | null {
  const fullKey = PREFIX + key;
  const raw = rawGet(fullKey);
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env || typeof env !== 'object' || env.v !== SCHEMA_VERSION) {
      // Версия не совпала — даём шанс migrate'ить ниже, но пока просто null
      return null;
    }
    return env.data;
  } catch {
    // Битый JSON — очистим, чтобы не возвращалась ошибка каждый раз
    rawRemove(fullKey);
    return null;
  }
}

/**
 * Сохранить значение. Возвращает true если попало в localStorage,
 * false если только в memory (limit/private/SSR).
 */
export function save<T>(key: string, data: T): boolean {
  const env: Envelope<T> = { v: SCHEMA_VERSION, data, savedAt: Date.now() };
  return rawSet(PREFIX + key, JSON.stringify(env));
}

export function remove(key: string): void {
  rawRemove(PREFIX + key);
}

/**
 * Debounce helper для частых записей (например, при перетягивании ползунка).
 * Использование:
 *   const persist = debounceSave('sandbox.lastConfig', 500);
 *   onChange(cfg => persist(cfg));
 */
export function debounceSave<T>(key: string, delayMs: number): (data: T) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (data: T) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => save(key, data), delayMs);
  };
}
