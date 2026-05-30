// src/lib/deviceId.ts
//
// Stage 9.2: stable device identifier для anonymous persistence.
// Generates UUID once + persists в localStorage. Same device = same ID.

const STORAGE_KEY = 'langton.deviceId';

export function getDeviceId(): string {
  try {
    if (typeof window === 'undefined') return 'ssr-device';
    let id = window.localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // localStorage недоступен → fallback на session-only ID
    return `session-${Math.random().toString(36).slice(2, 12)}`;
  }
}
