// core/src/langton/rules.ts
//
// Правила движения муравья + направления.
// Это таблицы констант, никакой бизнес-логики.

/**
 * 4 направления в порядке: N, E, S, W.
 * Индексация совпадает с полем Ant.dir.
 *
 * Использование:
 *   const [dx, dy] = LA_DIRS[ant.dir];
 *   ant.x += dx; ant.y += dy;
 */
export const LA_DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],  // N (вверх)
  [1, 0],   // E (вправо)
  [0, 1],   // S (вниз)
  [-1, 0],  // W (влево)
] as const;

/**
 * Стандартные правила движения муравья.
 * Ключ → строка-паттерн. На каждом тике берётся буква по индексу state%len.
 *
 * 'R' — повернуть направо
 * 'L' — повернуть налево
 * 'U' — развернуться (uturn)
 * 'N' — не поворачивать (редко, для специальных правил)
 */
export const LA_RULES: Readonly<Record<string, string>> = {
  classic:  'RL',     // Известная магистраль через ~10k тиков
  reverse:  'LR',     // Инвертированный
  spiral:   'LRR',    // Тугие расширяющиеся спирали
  flower:   'RLR',    // Симметричный лепестковый узор
  weave:    'LRLR',   // Плетение
  tornado:  'LRRLR',  // Хаотичные шторма
  uturn:    'RR',     // Патрулирует маленькие зоны
} as const;

/**
 * Парсит строку правила, валидирует.
 * Допустимые символы: R, L, U, N.
 * Длина 1..6 (длиннее непрактично).
 *
 * @throws Error если правило невалидное
 */
export function parseRule(s: string): string {
  if (!s || s.length < 1 || s.length > 6) {
    throw new Error(`Invalid rule length: "${s}"`);
  }
  if (!/^[RLUN]+$/.test(s)) {
    throw new Error(`Invalid rule chars: "${s}"`);
  }
  return s;
}
