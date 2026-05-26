// src/lib/spriteLoader.ts
//
// Загрузчик спрайтов из public/skins/kenney/.
// Кэширует HTMLImageElement, делает fallback на emoji при ошибке загрузки.
//
// Использование (в LangtonField):
//   const sprite = getSprite(skinId);
//   if (sprite && sprite.complete && sprite.naturalWidth > 0) {
//     ctx.drawImage(sprite, cx-r, cy-r, r*2, r*2);
//   } else {
//     // fallback: shape или emoji
//   }

import { KENNEY_SKINS } from '@core/shared/skins';

interface SpriteEntry {
  img: HTMLImageElement;
  /** true когда хотя бы один раз попытка загрузки завершилась (success или error). */
  attempted: boolean;
  /** true если загрузка не удалась (404, network, etc). */
  failed: boolean;
}

const cache = new Map<string, SpriteEntry>();
let warnedMissing = false;

/**
 * Получить спрайт по ID. При первом запросе инициирует загрузку.
 * Возвращает HTMLImageElement (может быть ещё не загружен — проверить complete).
 *
 * Если skinId не в реестре или загрузка провалилась — null.
 */
export function getSprite(skinId: string): HTMLImageElement | null {
  if (typeof window === 'undefined') return null; // SSR safety

  const cached = cache.get(skinId);
  if (cached) {
    if (cached.failed) return null;
    return cached.img;
  }

  // Проверяем что skinId валидный
  if (!KENNEY_SKINS.find((s) => s.id === skinId)) return null;

  const img = new Image();
  const entry: SpriteEntry = { img, attempted: false, failed: false };
  cache.set(skinId, entry);

  img.onload = () => { entry.attempted = true; };
  img.onerror = () => {
    entry.attempted = true;
    entry.failed = true;
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn(
        `[skins] Kenney sprites not found in public/skins/kenney/. ` +
        `Add PNG files (e.g. cat.png, dog.png) or use 'shape' skin pack.`,
      );
    }
  };
  img.src = `/skins/kenney/${skinId}.png`;

  return img;
}

/**
 * Получить ID скина для индекса игрока.
 * Циклит по KENNEY_SKINS если игроков больше 10.
 */
export function skinIdForPlayer(playerIndex: number): string {
  return KENNEY_SKINS[playerIndex % KENNEY_SKINS.length]!.id;
}

/** Очистить кэш — для тестов. */
export function _clearSpriteCache(): void {
  cache.clear();
  warnedMissing = false;
}
