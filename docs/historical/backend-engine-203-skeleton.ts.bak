// core/src/langton/engine.ts
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Сим-движок Лэнгтона                                                     ║
// ║  Порт из фронтенд-прототипа langton.jsx                                  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// Этот файл — ЯДРО ВСЕЙ ИГРЫ. Любое изменение здесь меняет правила игры
// и потенциально ломает совместимость с уже записанными replays.
//
// Подробное обоснование архитектуры — в docs/backend-architecture.md §5.
//
// ─────────────────────────────────────────────────────────────────────────────
// Что должен реализовывать этот файл
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. makeLangtonState(config) → SimState
//    Создаёт начальное состояние симуляции. Без побочных эффектов.
//
// 2. stepLangton(sim) → events
//    Выполняет ОДИН тик симуляции. Мутирует sim in-place для производительности.
//    Возвращает события для рассылки клиентам.
//
//    Должен быть детерминированным: stepLangton(s1) и stepLangton(s2),
//    где s1 и s2 — структурно идентичные snapshot'ы, дают одинаковый
//    результат.
//
// 3. Все случайные решения внутри используют sim.rng (mulberry32 с seed
//    из конфига). Никакого Math.random()!
//
// ─────────────────────────────────────────────────────────────────────────────
// Что делает один тик stepLangton (в порядке выполнения)
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. Для каждого живого муравья:
//    a) Прочесть state клетки, в которой стоит муравей
//    b) По правилу муравья (rule[state % len]) определить поворот
//    c) Поменять direction
//    d) Инкрементировать state клетки
//    e) Переписать owner клетки на свой
//    f) Сделать шаг вперёд (по тору — wrap-around)
//
// 2. Сгруппировать муравьёв по клеткам, где они оказались
//    Если в одной клетке оказались муравьи РАЗНЫХ игроков:
//    a) Записать collision event
//    b) Для каждого муравья в группе:
//       — проверить immunity: если sim.tick - a.lastDamageTick < cd → skip
//       — посчитать врагов (другие owners в той же клетке)
//       — нанести damage = Math.min(1, enemies)  ← damage cap критичен!
//       — обновить a.lastDamageTick = sim.tick
//       — если a.hp <= 0 → пометить dead, записать death event
//
// 3. Если sim.birthConfig.enabled — обработать рождение:
//    a) Сгруппировать живых муравьёв по owner
//    b) Для каждого owner:
//       — проверить cooldown (sim.lastBirthTickByOwner)
//       — проверить лимит (maxAntsPerPlayer)
//       — найти муравья с N+ своих соседних клеток (minNeighbors)
//       — выбрать свободную соседнюю клетку
//       — определить результат: обычное рождение / hybrid / wild
//       — спавнить нового муравья, записать birth event
//
// 4. sim.tick++
//
// ─────────────────────────────────────────────────────────────────────────────

import { mulberry32, type PRNG } from './prng';
import { LA_DIRS } from './rules';

/** Один муравей в симуляции. */
export interface Ant {
  /** Уникальный ID в пределах матча. Формат: `p{ownerIdx}_a{seq}` или `birth_{tick}_{seq}`. */
  id: string;
  /** Индекс владельца (0..N-1 для игроков, 255 для дикого). */
  owner: number;
  /** Координата X (0..w-1). */
  x: number;
  /** Координата Y (0..h-1). */
  y: number;
  /** Направление: 0=N, 1=E, 2=S, 3=W. */
  dir: 0 | 1 | 2 | 3;
  /** Строка правила, например `'RL'`, `'LRR'`, `'RLR'`. */
  rule: string;
  /** Текущее HP. При 0 муравей умирает. */
  hp: number;
  /** Максимальное HP (для расчёта hpRatio в UI). */
  maxHp: number;
  /** Тик последнего полученного урона. -9999 если ни разу. */
  lastDamageTick: number;
  /** Тик рождения. 0 для стартовых, sim.tick для born. */
  bornAt: number;
  /** Помечен мёртвым в текущем или прошлых тиках. */
  dead?: boolean;
  /** Рождён как гибрид (правило склеено из двух родителей). */
  isHybrid?: boolean;
  /** Дикий муравей (owner=255). */
  isWild?: boolean;
}

/** Полное состояние симуляции одного матча. */
export interface SimState {
  /** Ширина поля в клетках. */
  w: number;
  /** Высота поля в клетках. */
  h: number;
  /** Текущий тик (инкрементируется в конце stepLangton). */
  tick: number;
  /** Массив всех муравьёв (включая мёртвых до cleanup). */
  ants: Ant[];
  /** Owner-grid: длина w*h, индексация i = y*w + x. 0=neutral, 1..N=player, 255=wild. */
  owner: Uint8Array;
  /** State-grid: длина w*w, бинарное состояние клетки для физики Лэнгтона. */
  state: Uint8Array;
  /** Иммунитет после столкновения, в тиках. Дефолт 5. */
  collisionCooldownTicks: number;
  /** Конфигурация рождения (если null — рождения отключены). */
  birthConfig: BirthConfig | null;
  /** Last-birth-tick по owner (для cooldown). */
  lastBirthTickByOwner: Record<number, number>;
  /** Seeded PRNG. Все случайные решения берут отсюда. */
  rng: PRNG;
  /** Изначальный seed (для replay). */
  seed: number;
}

export interface BirthConfig {
  enabled: boolean;
  /** Сколько своих клеток нужно вокруг кандидата (3..8). */
  minNeighbors: number;
  /** Тиков между рождениями у одного owner. */
  cooldownTicks: number;
  /** Лимит живых муравьёв на игрока. */
  maxAntsPerPlayer: number;
  /** Шанс гибрида при рождении (0..1). */
  hybridChance: number;
  /** Шанс дикого вместо обычного рождения (0..1). */
  wildChance: number;
}

export interface MakeStateConfig {
  w: number;
  h: number;
  ants: Omit<Ant, 'maxHp' | 'lastDamageTick' | 'bornAt'>[];
  seed?: number;
  collisionCooldownTicks?: number;
  birthConfig?: BirthConfig | null;
}

export interface StepEvents {
  /** Захват клетки (для visual flash и звука). */
  captures: Array<{ x: number; y: number; owner: number }>;
  /** Столкновение разных игроков. */
  collisions: Array<{ x: number; y: number; antIds: string[] }>;
  /** Урон отдельному муравью. */
  damage: Array<{ id: string; owner: number; hp: number; enemies: number }>;
  /** Смерть муравья. */
  deaths: Array<{ id: string; owner: number; x: number; y: number }>;
  /** Рождение муравья. */
  births: Array<{ id: string; owner: number; x: number; y: number }>;
  /** Гибрид (подмножество births). */
  hybrids: Array<{ id: string; parents: [string, string] }>;
  /** Дикий муравей (подмножество births). */
  wilds: Array<{ id: string; x: number; y: number }>;
}

/**
 * Создаёт начальное состояние симуляции.
 *
 * @example
 * const sim = makeLangtonState({
 *   w: 100, h: 100, seed: 42,
 *   ants: [
 *     { id: 'p0_a0', owner: 0, x: 30, y: 30, dir: 0, rule: 'RL', hp: 3 },
 *     { id: 'p1_a0', owner: 1, x: 70, y: 70, dir: 2, rule: 'LRR', hp: 3 },
 *   ],
 * });
 */
export function makeLangtonState(_config: MakeStateConfig): SimState {
  // TODO: реализовать
  // 1. Аллоцировать Uint8Array размера w*h для owner и state
  // 2. Инициализировать ants с дефолтами для maxHp, lastDamageTick, bornAt
  // 3. Создать PRNG через mulberry32(seed)
  // 4. Заполнить sim.owner начальными клетками под каждым муравьём
  throw new Error('makeLangtonState not implemented');
}

/**
 * Выполняет один тик симуляции. МУТИРУЕТ sim in-place.
 * Возвращает события для рассылки клиентам.
 *
 * Этот метод должен быть БИТ-В-БИТ детерминированным:
 * stepLangton(snapshot1) и stepLangton(snapshot2), где snapshot1 и snapshot2
 * структурно идентичны — должны вернуть структурно идентичные events
 * и привести sim к идентичному состоянию.
 */
export function stepLangton(_sim: SimState): StepEvents {
  // TODO: реализовать по алгоритму в шапке файла
  throw new Error('stepLangton not implemented');
}

/** Используется в LA_DIRS, не экспортируется. */
const _DIRS_REFERENCE = LA_DIRS;
void _DIRS_REFERENCE;
