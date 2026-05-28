// src/lib/nicknames.ts
//
// Stage 8 Day 7: client-side nickname generator. Соответствует server-side
// в @langton/mvp-server/src/nicknames — pattern <Adj><Animal>-NN.
// Можно скопировать или генерировать локально — server валидирует.

const ADJECTIVES = [
  'Brave', 'Silent', 'Swift', 'Clever', 'Lucky', 'Sharp',
  'Wild', 'Calm', 'Bold', 'Quick', 'Mighty', 'Sneaky',
  'Loyal', 'Fierce', 'Noble', 'Wise', 'Lone', 'Stormy',
  'Sunny', 'Frosty', 'Cosmic', 'Iron', 'Golden', 'Silver',
  'Quiet', 'Tiny', 'Tall', 'Daring', 'Witty', 'Crimson',
];

const ANIMALS = [
  'Ant', 'Fox', 'Wolf', 'Owl', 'Bee', 'Hawk',
  'Bear', 'Lynx', 'Crane', 'Tiger', 'Otter', 'Hare',
  'Badger', 'Falcon', 'Stag', 'Mole', 'Mouse', 'Cat',
  'Crow', 'Eagle', 'Heron', 'Mink', 'Quail', 'Newt',
  'Frog', 'Toad', 'Vole', 'Pike', 'Bat', 'Carp',
];

/** Generate nickname в формате `<Adj><Animal>-NN`. */
export function generateNickname(): string {
  const adj    = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] ?? 'Brave';
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]       ?? 'Ant';
  const num    = Math.floor(Math.random() * 100);
  return `${adj}${animal}-${num.toString().padStart(2, '0')}`;
}

/** Storage key — сохраняем nickname в localStorage между сессиями. */
const STORAGE_KEY = 'langton.match.nickname';

/** Получить сохранённый или сгенерировать новый nickname. */
export function getOrCreateNickname(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.length > 0 && stored.length <= 40) return stored;
  } catch { /* ignore */ }
  const nick = generateNickname();
  try { localStorage.setItem(STORAGE_KEY, nick); } catch { /* ignore */ }
  return nick;
}

/** Заменить nickname (с persist). */
export function setStoredNickname(name: string): void {
  try { localStorage.setItem(STORAGE_KEY, name); } catch { /* ignore */ }
}
