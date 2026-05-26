// src/core/langton/engine.ts
//
// Полностью рабочий сим-движок Лэнгтона.
// Поддерживает: HP, immunity frames, damage cap, рождение/гибриды/диких.
//
// Используется в SandboxScreen для live-визуализации.
// В production-варианте этот код будет общим с бэкендом (через @langton/core).

import { LA_DIRS } from './rules';
import { mulberry32, type PRNG } from './prng';

export interface Ant {
  id: string;
  owner: number;
  x: number;
  y: number;
  dir: 0 | 1 | 2 | 3;
  rule: string;
  hp: number;
  maxHp: number;
  lastDamageTick: number;
  bornAt: number;
  dead?: boolean;
  isHybrid?: boolean;
  isWild?: boolean;
  /** Stage 5: мутант — родился при выполнении одного из mutation conditions. */
  isMutant?: boolean;
  /** Stage 5: какое условие сработало. Приоритет halo > mirror > path. */
  mutantCause?: 'halo' | 'mirror' | 'path';
  /** Stage 5: счётчик тиков подряд без damage (для условия Path). */
  straightTicks?: number;
}

export interface BirthConfig {
  enabled: boolean;
  minNeighbors: number;
  cooldownTicks: number;
  maxAntsPerPlayer: number;
  hybridChance: number;
  wildChance: number;
  /** Stage 2: если true — игнорируется maxAntsPerPlayer; cap = w*h - 1. */
  unlimited?: boolean;
  /** Stage 5: Mutation conditions. Если объект не передан — мутации выключены. */
  mutation?: {
    haloEnabled: boolean;
    haloMinNeighbors: number;
    mirrorEnabled: boolean;
    mirrorRadius: number;
    pathEnabled: boolean;
    pathStraightTicks: number;
  };
}

export interface SimState {
  w: number;
  h: number;
  tick: number;
  ants: Ant[];
  /** Owner-grid (1..N для игроков, 0 нейтральный, 255 wild). */
  owner: Uint8Array;
  /** State-grid для физики Лэнгтона (0..len-1 по правилу). */
  state: Uint8Array;
  collisionCooldownTicks: number;
  /** Stage 3: если false — HP не вычитается, муравьи не умирают (обзорный режим). */
  hpEnabled: boolean;
  /** Stage 3: если false — урон накопительный (каждый враг = −1 HP). */
  damageCapEnabled: boolean;
  birthConfig: BirthConfig | null;
  lastBirthTickByOwner: Record<number, number>;
  rng: PRNG;
  seed: number;
}

export interface StepEvents {
  captures: Array<{ x: number; y: number; owner: number }>;
  collisions: Array<{ x: number; y: number; antIds: string[] }>;
  damage: Array<{ id: string; owner: number; hp: number; enemies: number }>;
  deaths: Array<{ id: string; owner: number; x: number; y: number }>;
  births: Array<{
    id: string; owner: number; x: number; y: number;
    isHybrid: boolean; isWild: boolean;
    isMutant?: boolean;
    mutantCause?: 'halo' | 'mirror' | 'path';
  }>;
}

export interface MakeStateConfig {
  w: number;
  h: number;
  ants: Array<Omit<Ant, 'maxHp' | 'lastDamageTick' | 'bornAt'> & { maxHp?: number }>;
  seed?: number;
  collisionCooldownTicks?: number;
  /** Stage 3: false → муравьи неуязвимы (обзорный режим). По умолчанию true. */
  hpEnabled?: boolean;
  /** Stage 3: false → урон накопительный, каждый враг −1 HP. По умолчанию true. */
  damageCapEnabled?: boolean;
  birthConfig?: BirthConfig | null;
}

export function makeLangtonState(config: MakeStateConfig): SimState {
  const {
    w, h, ants: rawAnts, seed = 1,
    collisionCooldownTicks = 5,
    hpEnabled = true,
    damageCapEnabled = true,
    birthConfig = null,
  } = config;

  const owner = new Uint8Array(w * h);
  const state = new Uint8Array(w * h);

  const ants: Ant[] = rawAnts.map((a) => ({
    id: a.id,
    owner: a.owner,
    x: a.x,
    y: a.y,
    dir: a.dir,
    rule: a.rule,
    hp: a.hp,
    maxHp: a.maxHp ?? a.hp,
    lastDamageTick: -9999,
    bornAt: 0,
    dead: false,
  }));

  // Помечаем стартовые клетки под муравьями владельцем
  for (const a of ants) {
    if (a.x >= 0 && a.x < w && a.y >= 0 && a.y < h) {
      owner[a.y * w + a.x] = a.owner + 1;     // +1 чтобы 0 оставить как "нейтральный"
    }
  }

  return {
    w, h, tick: 0, ants, owner, state,
    collisionCooldownTicks,
    hpEnabled,
    damageCapEnabled,
    birthConfig,
    lastBirthTickByOwner: {},
    rng: mulberry32(seed),
    seed,
  };
}

export function stepLangton(sim: SimState): StepEvents {
  const { w, h, owner, state, ants } = sim;
  const events: StepEvents = {
    captures: [],
    collisions: [],
    damage: [],
    deaths: [],
    births: [],
  };

  // ─── 1. Движение каждого живого муравья ───────────────────────────────────
  for (const a of ants) {
    if (a.dead) continue;
    const i = a.y * w + a.x;
    const s = state[i] ?? 0;
    const ch = a.rule[s % a.rule.length] ?? 'R';
    if (ch === 'R') a.dir = ((a.dir + 1) & 3) as 0 | 1 | 2 | 3;
    else if (ch === 'L') a.dir = ((a.dir + 3) & 3) as 0 | 1 | 2 | 3;
    else if (ch === 'U') a.dir = ((a.dir + 2) & 3) as 0 | 1 | 2 | 3;

    state[i] = (s + 1) % a.rule.length;
    const prevOwner = owner[i];
    const newOwner = a.owner === 255 ? 255 : a.owner + 1;
    owner[i] = newOwner;
    if (prevOwner !== newOwner) {
      events.captures.push({ x: a.x, y: a.y, owner: a.owner });
    }

    const dir = LA_DIRS[a.dir]!;
    a.x = (a.x + dir[0] + w) % w;
    a.y = (a.y + dir[1] + h) % h;
  }

  // ─── 2. Группировка по клеткам, разрешение коллизий ───────────────────────
  const cellMap = new Map<number, Ant[]>();
  for (const a of ants) {
    if (a.dead) continue;
    const k = a.y * w + a.x;
    let list = cellMap.get(k);
    if (!list) { list = []; cellMap.set(k, list); }
    list.push(a);
  }

  const cd = sim.collisionCooldownTicks;
  for (const [, group] of cellMap) {
    if (group.length < 2) continue;
    const owners = new Set(group.map((a) => a.owner));
    if (owners.size < 2) continue;

    events.collisions.push({
      x: group[0]!.x,
      y: group[0]!.y,
      antIds: group.map((a) => a.id),
    });

    // Если HP отключён — фиксируем коллизию как событие, но урона не наносим.
    // Муравьи продолжают двигаться, статистика clashes идёт, для аналитики полезно.
    if (!sim.hpEnabled) continue;

    for (const a of group) {
      // Иммунитет после недавнего урона
      if (sim.tick - a.lastDamageTick < cd) continue;

      const enemies = group.reduce((n, b) => n + (b.owner !== a.owner ? 1 : 0), 0);
      // Damage cap: если включён — максимум −1 HP за столкновение. Иначе — накопительно.
      const dmg = sim.damageCapEnabled ? Math.min(1, enemies) : enemies;
      a.hp -= dmg;
      a.lastDamageTick = sim.tick;
      a.straightTicks = 0; // Stage 5: сброс при damage
      events.damage.push({ id: a.id, owner: a.owner, hp: a.hp, enemies });

      if (a.hp <= 0 && !a.dead) {
        a.dead = true;
        events.deaths.push({ id: a.id, owner: a.owner, x: a.x, y: a.y });
      }
    }
  }

  // ─── 2.5. Stage 5: инкремент straightTicks для живых не получивших damage ─
  // Используется для condition Path в processBirths.
  for (const a of ants) {
    if (a.dead) continue;
    if (a.lastDamageTick === sim.tick) continue; // только что получил damage — пропускаем
    a.straightTicks = (a.straightTicks ?? 0) + 1;
  }

  // ─── 3. Рождение (детерминированные правила) ──────────────────────────────
  // Все случайные выборы заменены на детерминированные правила:
  //  - Родитель: тот у кого МАКСИМУМ своих соседей (центр массы колонии).
  //              При равенстве — наименьший id (стабильность).
  //  - Клетка рождения: первая свободная по часовой стрелке начиная с N
  //                    (N → E → S → W → NE → SE → SW → NW).
  //  - Направление новорождённого: как у родителя.
  //  - Гибрид: если есть муравей ДРУГОГО игрока в радиусе 2 клеток от родителя.
  //           Берётся ближайший (по Чебышёву, потом по id).
  //  - Wild: если среди 8 соседей клетки рождения >= 5 разных owner'ов.
  //         Правило перемешивается детерминированно (циклический сдвиг на N
  //         где N = tick % length).
  //  - Hybrid И wild могут совпасть: wild имеет приоритет.
  const bc = sim.birthConfig;
  if (bc && bc.enabled) {
    const aliveByOwner = new Map<number, Ant[]>();
    for (const a of ants) {
      if (a.dead || a.owner === 255) continue;
      let list = aliveByOwner.get(a.owner);
      if (!list) { list = []; aliveByOwner.set(a.owner, list); }
      list.push(a);
    }

    // Сортируем по ownerId для детерминированного порядка обработки
    const sortedOwners = [...aliveByOwner.entries()].sort(([a], [b]) => a - b);

    for (const [ownerId, ownAnts] of sortedOwners) {
      const last = sim.lastBirthTickByOwner[ownerId] ?? -9999;
      if (sim.tick - last < bc.cooldownTicks) continue;

      // Лимит per-player или unlimited с глобальным cap
      if (bc.unlimited) {
        const totalAlive = ants.reduce((n, a) => n + (a.dead ? 0 : 1), 0);
        if (totalAlive >= w * h - 1) continue;
      } else {
        if (ownAnts.length >= bc.maxAntsPerPlayer) continue;
      }

      // ─── Выбор родителя: МАКСИМУМ своих соседей ─────────────────────────
      // При равенстве — наименьший id (детерминированный tiebreaker).
      let chosen: Ant | null = null;
      let bestCount = -1;
      for (const cand of ownAnts) {
        let cnt = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (cand.x + dx + w) % w;
          const ny = (cand.y + dy + h) % h;
          if (owner[ny * w + nx] === ownerId + 1) cnt++;
        }
        if (cnt < bc.minNeighbors) continue;
        if (cnt > bestCount || (cnt === bestCount && chosen && cand.id < chosen.id)) {
          bestCount = cnt;
          chosen = cand;
        }
      }
      if (!chosen) continue;

      // ─── Клетка рождения: первая свободная по часовой стрелке ───────────
      // Порядок: N (0,-1), NE (1,-1), E (1,0), SE (1,1), S (0,1), SW (-1,1),
      //          W (-1,0), NW (-1,-1)
      const CLOCK_OFFSETS: ReadonlyArray<readonly [number, number]> = [
        [0, -1], [1, -1], [1, 0], [1, 1],
        [0, 1], [-1, 1], [-1, 0], [-1, -1],
      ] as const;

      let spot: { x: number; y: number } | null = null;
      for (const [dx, dy] of CLOCK_OFFSETS) {
        const nx = (chosen.x + dx + w) % w;
        const ny = (chosen.y + dy + h) % h;
        if (!ants.some((b) => !b.dead && b.x === nx && b.y === ny)) {
          spot = { x: nx, y: ny };
          break;
        }
      }
      if (!spot) continue;

      // ─── Решение wild / hybrid / normal — детерминированно ──────────────
      let newOwner = ownerId;
      let newRule = chosen.rule;
      let isHybrid = false;
      let isWild = false;

      // Wild: 5+ разных owner'ов среди 8 соседей клетки рождения
      const neighborOwners = new Set<number>();
      for (const [dx, dy] of CLOCK_OFFSETS) {
        const nx = (spot.x + dx + w) % w;
        const ny = (spot.y + dy + h) % h;
        const o = owner[ny * w + nx]!;
        if (o !== 0) neighborOwners.add(o);
      }

      if (neighborOwners.size >= 5) {
        newOwner = 255;
        newRule = cyclicShift(chosen.rule, sim.tick % chosen.rule.length);
        isWild = true;
      } else {
        // Hybrid: есть муравей другого игрока в радиусе 2 от родителя
        let nearestOther: Ant | null = null;
        let nearestDist = 999;
        for (const other of ants) {
          if (other.dead || other.owner === ownerId || other.owner === 255) continue;
          // Чебышёв (по торусу)
          const ddx = Math.min(
            Math.abs(other.x - chosen.x),
            w - Math.abs(other.x - chosen.x),
          );
          const ddy = Math.min(
            Math.abs(other.y - chosen.y),
            h - Math.abs(other.y - chosen.y),
          );
          const dist = Math.max(ddx, ddy);
          if (dist > 2) continue;
          if (dist < nearestDist || (dist === nearestDist && nearestOther && other.id < nearestOther.id)) {
            nearestDist = dist;
            nearestOther = other;
          }
        }
        if (nearestOther) {
          newRule = mixRules(chosen.rule, nearestOther.rule);
          isHybrid = true;
        }
      }

      // ─── Stage 5: Mutation conditions ─────────────────────────────────
      // Проверяются независимо от hybrid/wild. Можно быть mutant + hybrid.
      // Приоритет при совпадении: halo > mirror > path.
      let isMutant = false;
      let mutantCause: 'halo' | 'mirror' | 'path' | undefined;
      const m = bc.mutation;
      if (m) {
        // Halo: своих в 8-окрестности клетки рождения
        if (m.haloEnabled) {
          let own = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = (spot.x + dx + w) % w;
            const ny = (spot.y + dy + h) % h;
            if (owner[ny * w + nx] === ownerId + 1) own++;
          }
          if (own >= m.haloMinNeighbors) {
            isMutant = true;
            mutantCause = 'halo';
          }
        }
        // Mirror: точка рождения симметрична через врага в радиусе R
        if (!isMutant && m.mirrorEnabled) {
          for (const other of ants) {
            if (other.dead || other.owner === ownerId || other.owner === 255) continue;
            const dx = Math.min(Math.abs(spot.x - other.x), w - Math.abs(spot.x - other.x));
            const dy = Math.min(Math.abs(spot.y - other.y), h - Math.abs(spot.y - other.y));
            const dist = Math.max(dx, dy);
            if (dist > m.mirrorRadius) continue;
            const expectedX = (2 * other.x - chosen.x + w) % w;
            const expectedY = (2 * other.y - chosen.y + h) % h;
            if (expectedX === spot.x && expectedY === spot.y) {
              isMutant = true;
              mutantCause = 'mirror';
              break;
            }
          }
        }
        // Path: родитель N+ тиков без damage
        if (!isMutant && m.pathEnabled) {
          if ((chosen.straightTicks ?? 0) >= m.pathStraightTicks) {
            isMutant = true;
            mutantCause = 'path';
          }
        }
      }

      const newAnt: Ant = {
        id: `birth_${sim.tick}_${ants.length}`,
        owner: newOwner,
        x: spot.x,
        y: spot.y,
        dir: chosen.dir,
        rule: newRule,
        hp: 3,
        maxHp: 3,
        lastDamageTick: -9999,
        bornAt: sim.tick,
        isHybrid,
        isWild,
        isMutant,
        mutantCause,
        straightTicks: 0,
      };
      ants.push(newAnt);
      sim.lastBirthTickByOwner[ownerId] = sim.tick;
      events.births.push({
        id: newAnt.id, owner: newOwner, x: spot.x, y: spot.y,
        isHybrid, isWild, isMutant, mutantCause,
      });
    }
  }

  sim.tick++;

  // ─── 4. Garbage collection мёртвых каждые 200 тиков ───────────────────────
  // Без этого массив ants растёт безграничено даже при включённом лимите.
  if (sim.tick % 200 === 0) {
    sim.ants = ants.filter((a) => !a.dead);
  }

  return events;
}

/**
 * Циклический сдвиг символов правила (для wild). Детерминированно.
 * Сдвиг на N позиций влево: 'RLR'.shift(1) → 'LRR', .shift(2) → 'RRL'
 */
function cyclicShift(rule: string, n: number): string {
  if (rule.length <= 1) return rule;
  const k = ((n % rule.length) + rule.length) % rule.length;
  return rule.slice(k) + rule.slice(0, k);
}

/** Склеить два правила в одно. Длина не больше 6. Чисто. */
function mixRules(a: string, b: string): string {
  let out = '';
  const max = Math.min(6, Math.max(a.length, b.length));
  for (let i = 0; i < max; i++) {
    out += a[i % a.length] ?? '';
    if (out.length < 6) out += b[i % b.length] ?? '';
    if (out.length >= 6) break;
  }
  return out.slice(0, 6);
}
