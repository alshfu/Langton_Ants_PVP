// src/lib/urlShare.ts
//
// Stage 7: URL-encoding для shared конфигов и replays.
//
// Используется lz-string + URL-safe base64. Типичные размеры:
//   - SandboxConfig (минимальный)     →  ~500-1500 chars в URL
//   - SandboxConfig (с 10 муравьями)  → ~1500-3000 chars
//   - Replay 500 тиков, 10 deploys    → ~2000-3500 chars
//   - Replay 5000 тиков, 100 deploys  → ~8000-12000 chars
//
// Chrome принимает URL до 32K chars, Safari ~80K. Большие replays
// помещаются с запасом; для очень больших — fallback на JSON download.

import LZString from 'lz-string';
import type { SandboxConfig } from '@core/contract/state';
import type { Replay } from '@core/contract/replay';
import { REPLAY_FORMAT_VERSION } from '@core/contract/replay';

/** Версия URL формата для будущей совместимости (если поменяется compression). */
export const URL_FORMAT_VERSION = 1;

/** Метка типа payload в URL — для распознавания при decode. */
type SharedPayload =
  | { kind: 'preset'; version: number; data: SandboxConfig }
  | { kind: 'replay'; version: number; data: Replay };

/** URL-параметры: ?p=<base64> для preset, ?r=<base64> для replay. */
export const URL_PARAM_PRESET = 'p';
export const URL_PARAM_REPLAY = 'r';

// ─── Encode ──────────────────────────────────────────────────────────────────

/** Закодировать SandboxConfig для URL share. */
export function encodePresetForUrl(config: SandboxConfig): string {
  const payload: SharedPayload = {
    kind: 'preset',
    version: URL_FORMAT_VERSION,
    data: config,
  };
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

/** Закодировать Replay для URL share. */
export function encodeReplayForUrl(replay: Replay): string {
  const payload: SharedPayload = {
    kind: 'replay',
    version: URL_FORMAT_VERSION,
    data: replay,
  };
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

/** Построить полный URL share — относительно текущего origin. */
export function buildShareUrl(encoded: string, kind: 'preset' | 'replay'): string {
  if (typeof window === 'undefined') {
    return `?${kind === 'preset' ? URL_PARAM_PRESET : URL_PARAM_REPLAY}=${encoded}`;
  }
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const param = kind === 'preset' ? URL_PARAM_PRESET : URL_PARAM_REPLAY;
  return `${baseUrl}?${param}=${encoded}`;
}

// ─── Decode ──────────────────────────────────────────────────────────────────

export interface DecodeResult {
  ok: boolean;
  kind?: 'preset' | 'replay';
  data?: SandboxConfig | Replay;
  reason?: string;
}

/** Декодировать payload из URL-параметра. Безопасно — возвращает result с reason. */
export function decodeFromUrl(encoded: string): DecodeResult {
  if (!encoded || typeof encoded !== 'string') {
    return { ok: false, reason: 'Empty payload' };
  }
  let json: string | null;
  try {
    json = LZString.decompressFromEncodedURIComponent(encoded);
  } catch {
    return { ok: false, reason: 'Decompression failed' };
  }
  if (!json) {
    return { ok: false, reason: 'Invalid encoded data' };
  }
  let parsed: SharedPayload | null;
  try {
    parsed = JSON.parse(json) as SharedPayload;
  } catch {
    return { ok: false, reason: 'Malformed JSON' };
  }
  if (!parsed || typeof parsed !== 'object' || !('kind' in parsed)) {
    return { ok: false, reason: 'Unrecognized payload structure' };
  }
  // Version check
  if (parsed.version !== URL_FORMAT_VERSION) {
    return {
      ok: false,
      reason: `URL format v${parsed.version} not supported (expected v${URL_FORMAT_VERSION})`,
    };
  }
  if (parsed.kind === 'preset') {
    if (!parsed.data || typeof parsed.data !== 'object') {
      return { ok: false, reason: 'Missing preset data' };
    }
    return { ok: true, kind: 'preset', data: parsed.data };
  }
  if (parsed.kind === 'replay') {
    const replay = parsed.data;
    if (!replay || typeof replay !== 'object' || replay.version !== REPLAY_FORMAT_VERSION) {
      return {
        ok: false,
        reason: `Replay format v${(replay as any)?.version} not supported (expected v${REPLAY_FORMAT_VERSION})`,
      };
    }
    if (!Array.isArray(replay.deployTimeline)) {
      return { ok: false, reason: 'Replay missing deployTimeline' };
    }
    return { ok: true, kind: 'replay', data: replay };
  }
  return { ok: false, reason: `Unknown kind: ${(parsed as any).kind}` };
}

// ─── URL parsing on app load ─────────────────────────────────────────────────

/** Проверить текущий URL — есть ли shared payload. Возвращает DecodeResult. */
export function parseSharedFromCurrentUrl(): DecodeResult | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const preset = params.get(URL_PARAM_PRESET);
  if (preset) return decodeFromUrl(preset);
  const replay = params.get(URL_PARAM_REPLAY);
  if (replay) return decodeFromUrl(replay);
  return null;
}

/** Очистить URL от shared параметров после load (history.replaceState). */
export function clearSharedFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete(URL_PARAM_PRESET);
  url.searchParams.delete(URL_PARAM_REPLAY);
  window.history.replaceState({}, '', url.toString());
}

// ─── JSON file export/import ─────────────────────────────────────────────────

/** Запустить download .json файла с конфигом или replay. */
export function downloadJson(filename: string, data: SandboxConfig | Replay): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Освобождаем ObjectURL через setTimeout — некоторые браузеры теряют link если revoke сразу
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/** Парсинг загруженного JSON файла. Распознаёт preset или replay. */
export interface ParsedJsonFile {
  ok: boolean;
  kind?: 'preset' | 'replay';
  data?: SandboxConfig | Replay;
  reason?: string;
}

export function parseJsonFile(text: string): ParsedJsonFile {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'Invalid JSON' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'Not an object' };
  }
  // Replay distinguish: has `version`, `metadata`, `config`, `deployTimeline`
  if ('metadata' in parsed && 'config' in parsed && Array.isArray(parsed.deployTimeline)) {
    if (parsed.version !== REPLAY_FORMAT_VERSION) {
      return { ok: false, reason: `Replay format v${parsed.version} not supported` };
    }
    return { ok: true, kind: 'replay', data: parsed as Replay };
  }
  // Иначе предполагаем SandboxConfig (минимальная проверка)
  if ('players' in parsed && 'width' in parsed && 'height' in parsed) {
    return { ok: true, kind: 'preset', data: parsed as SandboxConfig };
  }
  return { ok: false, reason: 'Unrecognized file structure (not a preset or replay)' };
}
