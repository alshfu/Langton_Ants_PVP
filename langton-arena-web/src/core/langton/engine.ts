// src/core/langton/engine.ts
//
// Полностью рабочий сим-движок Лэнгтона.
// Поддерживает: HP, immunity frames, damage cap, рождение/гибриды/диких.
//
// Используется в SandboxScreen для live-визуализации.
// В production-варианте этот код будет общим с бэкендом (через @langton/core).

import { LA_DIRS } from './rules';
import { mulberry32, randInt, type PRNG } from './prng';

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
  births: Array<{ id: string; owner: number; x: number; y: number; isHybrid: boolean; isWild: boolean }>;
}

export interface MakeStateConfig {
  w: number;
  h: number;
  ants: Array<Omit<Ant, 'maxHp' | 'lastDamageTick' | 'bornAt'> & { maxHp?: number }>;
  seed?: number;
  collisionCooldownTicks?: number;
  birthConfig?: BirthConfig | null;
}

export function makeLangtonState(config: MakeStateConfig): SimState {
  const { w, h, ants: rawAnts, seed = 1, collisionCooldownTicks = 5, birthConfig = null } = config;

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

    for (const a of group) {
      // Иммунитет после недавнего урона
      if (sim.tick - a.lastDamageTick < cd) continue;

      const enemies = group.reduce((n, b) => n + (b.owner !== a.owner ? 1 : 0), 0);
      // Damage cap: максимум −1 HP за столкновение, сколько бы врагов ни было
      const dmg = Math.min(1, enemies);
      a.hp -= dmg;
      a.lastDamageTick = sim.tick;
      events.damage.push({ id: a.id, owner: a.owner, hp: a.hp, enemies });

      if (a.hp <= 0 && !a.dead) {
        a.dead = true;
        events.deaths.push({ id: a.id, owner: a.owner, x: a.x, y: a.y });
      }
    }
  }

  // ─── 3. Рождение (если включено) ──────────────────────────────────────────
  const bc = sim.birthConfig;
  if (bc && bc.enabled) {
    const aliveByOwner = new Map<number, Ant[]>();
    for (const a of ants) {
      if (a.dead || a.owner === 255) continue;
      let list = aliveByOwner.get(a.owner);
      if (!list) { list = []; aliveByOwner.set(a.owner, list); }
      list.push(a);
    }

    for (const [ownerId, ownAnts] of aliveByOwner) {
      const last = sim.lastBirthTickByOwner[ownerId] ?? -9999;
      if (sim.tick - last < bc.cooldownTicks) continue;

      // Лимит per-player или unlimited с глобальным cap
      if (bc.unlimited) {
        const totalAlive = ants.reduce((n, a) => n + (a.dead ? 0 : 1), 0);
        if (totalAlive >= w * h - 1) continue; // глобальный cap = поле − 1
      } else {
        if (ownAnts.length >= bc.maxAntsPerPlayer) continue;
      }

      // Найти кандидата с ≥ minNeighbors своих соседних клеток
      let chosen: Ant | null = null;
      const sampleSize = Math.min(3, ownAnts.length);
      for (let s = 0; s < sampleSize; s++) {
        const cand = ownAnts[randInt(sim.rng, ownAnts.length)]!;
        let cnt = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (cand.x + dx + w) % w;
          const ny = (cand.y + dy + h) % h;
          if (owner[ny * w + nx] === ownerId + 1) cnt++;
        }
        if (cnt >= bc.minNeighbors) { chosen = cand; break; }
      }
      if (!chosen) continue;

      // Найти свободную соседнюю клетку
      const free: Array<{ x: number; y: number }> = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = (chosen.x + dx + w) % w;
        const ny = (chosen.y + dy + h) % h;
        if (!ants.some((b) => !b.dead && b.x === nx && b.y === ny)) {
          free.push({ x: nx, y: ny });
        }
      }
      if (free.length === 0) continue;
      const spot = free[randInt(sim.rng, free.length)]!;

      // Решаем — обычный / гибрид / дикий
      const roll = sim.rng();
      let newOwner = ownerId;
      let newRule = chosen.rule;
      let isHybrid = false;
      let isWild = false;

      if (roll < bc.wildChance) {
        newOwner = 255;
        newRule = scrambleRule(chosen.rule, sim.rng);
        isWild = true;
      } else if (roll < bc.wildChance + bc.hybridChance) {
        // Найти муравья другого игрока для миксования правил
        const otherOwners = [...aliveByOwner.entries()].filter(([o]) => o !== ownerId);
        if (otherOwners.length > 0) {
          const otherList = otherOwners[randInt(sim.rng, otherOwners.length)]![1];
          const other = otherList[randInt(sim.rng, otherList.length)]!;
          newRule = mixRules(chosen.rule, other.rule);
          isHybrid = true;
        }
      }

      const newAnt: Ant = {
        id: `birth_${sim.tick}_${ants.length}`,
        owner: newOwner,
        x: spot.x,
        y: spot.y,
        dir: randInt(sim.rng, 4) as 0 | 1 | 2 | 3,
        rule: newRule,
        hp: 3,
        maxHp: 3,
        lastDamageTick: -9999,
        bornAt: sim.tick,
        isHybrid,
        isWild,
      };
      ants.push(newAnt);
      sim.lastBirthTickByOwner[ownerId] = sim.tick;
      events.births.push({
        id: newAnt.id, owner: newOwner, x: spot.x, y: spot.y, isHybrid, isWild,
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

/** Перемешать символы правила (для wild). */
function scrambleRule(rule: string, rng: PRNG): string {
  const chars = rule.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

/** Склеить два правила в одно. Длина не больше 6. */
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
