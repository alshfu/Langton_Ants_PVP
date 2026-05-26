// src/state/presets.ts
//
// Загрузка built-in пресетов из public/presets/*.json.
// User-presets живут в localStorage и грузятся отдельно через lib/storage.

import type { BuiltinPreset } from '@core/contract/state';

interface PresetIndex {
  version: number;
  presets: Array<{ id: string; file: string }>;
}

/**
 * Загружает манифест и все built-in пресеты параллельно.
 * Возвращает уже распарсенный массив, в том же порядке что в index.json.
 *
 * Безопасно: при ошибке любого файла — лога, но не падаем; пропускаем битый.
 */
export async function loadBuiltinPresets(): Promise<BuiltinPreset[]> {
  let manifest: PresetIndex;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}presets/index.json`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    manifest = await r.json() as PresetIndex;
  } catch (err) {
    console.error('Failed to load presets manifest:', err);
    return [];
  }

  const results = await Promise.allSettled(
    manifest.presets.map(async (entry) => {
      const r = await fetch(`${import.meta.env.BASE_URL}presets/${entry.file}`);
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${entry.file}`);
      const data = await r.json() as BuiltinPreset;
      if (!validatePreset(data)) throw new Error(`Invalid format: ${entry.id}`);
      return data;
    }),
  );

  const ok: BuiltinPreset[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') ok.push(r.value);
    else console.warn(`Skipping preset ${manifest.presets[i]?.id}:`, r.reason);
  });
  return ok;
}

/** Минимальная валидация — что в JSON есть все обязательные поля. */
function validatePreset(p: unknown): p is BuiltinPreset {
  if (!p || typeof p !== 'object') return false;
  const obj = p as Record<string, unknown>;
  if (typeof obj.id !== 'string') return false;
  if (typeof obj.name !== 'string') return false;
  if (typeof obj.config !== 'object' || !obj.config) return false;

  const cfg = obj.config as Record<string, unknown>;
  if (typeof cfg.width !== 'number' || typeof cfg.height !== 'number') return false;
  if (!Array.isArray(cfg.players)) return false;

  return true;
}
