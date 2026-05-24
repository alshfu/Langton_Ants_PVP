// core/src/langton/prng.ts
//
// Детерминированный seeded PRNG (mulberry32).
// Это критичный компонент — все случайные решения в игре идут через него.
// Если PRNG недетерминирован → симуляция не воспроизводится → replays ломаются.
//
// Свойства mulberry32:
//   - Период ~2^32 (достаточно для одного матча 3000 тиков)
//   - Хорошее статистическое распределение
//   - Быстрый: ~10ns на вызов
//   - Простой: 4 строки кода, легко портировать в браузер 1-в-1

/** Функция-генератор случайных чисел в [0, 1). */
export type PRNG = () => number;

/**
 * Создаёт детерминированный PRNG на базе seed.
 *
 * Если в seed подать одинаковое число — последовательность будет одинаковая.
 * Это используется для replays: храним seed, повторно создаём PRNG.
 *
 * @param seed Целое число, обычно 32-битное
 * @returns Функция rng(), которая при каждом вызове возвращает следующее число
 *
 * @example
 *   const rng = mulberry32(42);
 *   rng();  // 0.6121701030060649
 *   rng();  // 0.2898840515408665
 *   // ...всегда та же последовательность для seed=42
 */
export function mulberry32(seed: number): PRNG {
  let a = seed >>> 0;
  return function rng(): number {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Целочисленный rand в [0, max).
 * Хелпер чтобы не забывать про floor.
 */
export function randInt(rng: PRNG, max: number): number {
  return Math.floor(rng() * max);
}

/**
 * Случайный элемент массива.
 * Возвращает undefined для пустого массива.
 */
export function pickRandom<T>(rng: PRNG, arr: ReadonlyArray<T>): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[randInt(rng, arr.length)];
}
