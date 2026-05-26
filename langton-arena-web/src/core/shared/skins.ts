// src/core/shared/skins.ts
//
// Реестр скинов-существ для опционального Kenney CC0 пака.
// Маппинг: индекс игрока → существо.
//
// Файлы кладутся в public/skins/kenney/{id}.png (32×32 PNG).
// Если файла нет — spriteLoader делает fallback на procedural shape.

export interface CreatureSkin {
  /** Идентификатор файла без расширения. */
  id: string;
  /** Имя существа для UI. */
  creature: string;
  /** Эмодзи-fallback (если PNG не загрузился). */
  emoji: string;
}

export const KENNEY_SKINS: ReadonlyArray<CreatureSkin> = [
  { id: 'cat',      creature: 'Cat',      emoji: '🐱' },
  { id: 'dog',      creature: 'Dog',      emoji: '🐶' },
  { id: 'spider',   creature: 'Spider',   emoji: '🕷' },
  { id: 'panda',    creature: 'Panda',    emoji: '🐼' },
  { id: 'mole',     creature: 'Mole',     emoji: '🦫' },
  { id: 'termite',  creature: 'Termite',  emoji: '🐜' },
  { id: 'human',    creature: 'Human',    emoji: '🧑' },
  { id: 'capybara', creature: 'Capybara', emoji: '🦫' },
  { id: 'dinosaur', creature: 'Dinosaur', emoji: '🦖' },
  { id: 'pony',     creature: 'Pony',     emoji: '🦄' },
] as const;
