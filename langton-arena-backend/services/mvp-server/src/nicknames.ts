// src/nicknames.ts
//
// Random animal nickname generator. Pattern: <Adjective><Animal>-<00-99>.
// Например: "BraveAnt-42", "SilentFox-91", "CleverOwl-07".
//
// Источник: spec §14 Q3 ответ A — animal nicknames для дружелюбной идентификации
// в логах. ~3000 уникальных комбинаций (30 adj × 30 animals × 100 numbers).

const ADJECTIVES: ReadonlyArray<string> = [
  'Brave',  'Silent', 'Swift',  'Clever', 'Lucky',  'Sharp',
  'Wild',   'Calm',   'Bold',   'Quick',  'Mighty', 'Sneaky',
  'Loyal',  'Fierce', 'Noble',  'Wise',   'Lone',   'Stormy',
  'Sunny',  'Frosty', 'Cosmic', 'Iron',   'Golden', 'Silver',
  'Quiet',  'Wild',   'Tiny',   'Tall',   'Daring', 'Witty',
];

const ANIMALS: ReadonlyArray<string> = [
  'Ant',    'Fox',    'Wolf',   'Owl',    'Bee',    'Hawk',
  'Bear',   'Lynx',   'Crane',  'Tiger',  'Otter',  'Hare',
  'Badger', 'Falcon', 'Stag',   'Mole',   'Mouse',  'Cat',
  'Crow',   'Eagle',  'Heron',  'Mink',   'Quail',  'Newt',
  'Frog',   'Toad',   'Vole',   'Pike',   'Bat',    'Carp',
];

/**
 * Сгенерировать nickname. Опциональный rand для детерминизма в тестах.
 * Default — Math.random.
 */
export function randomNickname(rand: () => number = Math.random): string {
  const adj    = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)] ?? 'Brave';
  const animal = ANIMALS[Math.floor(rand() * ANIMALS.length)]       ?? 'Ant';
  const num    = Math.floor(rand() * 100);
  return `${adj}${animal}-${num.toString().padStart(2, '0')}`;
}

/** Regex для validation/тестов. */
export const NICKNAME_PATTERN = /^[A-Z][a-z]+[A-Z][a-z]+-\d{2}$/;

/** Проверить что строка похожа на nickname (для server-side sanity). */
export function isValidNickname(s: string): boolean {
  if (typeof s !== 'string') return false;
  if (s.length === 0 || s.length > 40) return false;
  // Допускаем custom nicknames клиента — не только генерируемый паттерн.
  // Sanity: только printable ASCII + базовые symbols.
  return /^[\p{L}\p{N}_\-. ]+$/u.test(s);
}
