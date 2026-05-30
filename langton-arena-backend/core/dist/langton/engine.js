// core/src/langton/engine.ts
//
// Полностью рабочий сим-движок Лэнгтона.
// Поддерживает: HP, immunity frames, damage cap, рождение/гибриды/диких.
// Stage 7.6: 4 topology modes (torus / wall / bounce / void).
// Stage 8.day7-multi-grid: 3 grid types (square / triangle / hexagonal).
//
// Используется в SandboxScreen для live-визуализации и server-side в mvp-server.
import { mulberry32 } from './prng';
import { getNeighbors, getNumDirs, applyRuleChar } from './grid';
export function makeLangtonState(config) {
    const { w, h, ants: rawAnts, seed = 1, collisionCooldownTicks = 5, hpEnabled = true, damageCapEnabled = true, birthConfig = null, topology = 'torus', gridType = 'square', } = config;
    const owner = new Uint8Array(w * h);
    const state = new Uint8Array(w * h);
    const ants = rawAnts.map((a) => ({
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
            owner[a.y * w + a.x] = a.owner + 1; // +1 чтобы 0 оставить как "нейтральный"
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
        topology,
        gridType,
    };
}
/**
 * Stage 7.6: применить движение муравья учитывая topology.
 * Возвращает true если муравей умер (void). Дёргает a.x/a.y/a.dir/a.dead in place.
 *
 * - **torus**: wrap-around — `(x + dx + w) % w`
 * - **wall**:  если next pos out of bounds — остаётся на месте (не двигается).
 *              Не разворачивается; на следующем тике Langton-логика повернёт его
 *              по правилу.
 * - **bounce**: если next pos OOB — поворот на 180° (dir + 2), и не двигается.
 *              Следующий тик попробует в другую сторону.
 * - **void**:  если next pos OOB — муравей умирает.
 */
function applyMove(a, dx, dy, w, h, topo, numDirs) {
    const nx = a.x + dx;
    const ny = a.y + dy;
    const oob = nx < 0 || nx >= w || ny < 0 || ny >= h;
    switch (topo) {
        case 'torus':
            a.x = (nx + w) % w;
            a.y = (ny + h) % h;
            return false;
        case 'wall':
            if (!oob) {
                a.x = nx;
                a.y = ny;
            }
            return false;
        case 'bounce':
            if (!oob) {
                a.x = nx;
                a.y = ny;
            }
            else {
                a.dir = (a.dir + Math.floor(numDirs / 2)) % numDirs;
            }
            return false;
        case 'void':
            if (oob) {
                a.dead = true;
                return true;
            }
            a.x = nx;
            a.y = ny;
            return false;
    }
}
export function stepLangton(sim) {
    const { w, h, owner, state, ants } = sim;
    const events = {
        captures: [],
        collisions: [],
        damage: [],
        deaths: [],
        births: [],
    };
    // ─── 1. Движение каждого живого муравья ───────────────────────────────────
    // Stage 8 multi-grid: numDirs + neighbors берутся по gridType.
    const numDirs = getNumDirs(sim.gridType);
    for (const a of ants) {
        if (a.dead)
            continue;
        const i = a.y * w + a.x;
        const s = state[i] ?? 0;
        const ch = a.rule[s % a.rule.length] ?? 'R';
        // Apply turn — на любом грид'е R/L/U через applyRuleChar
        a.dir = applyRuleChar(a.dir, ch, numDirs);
        state[i] = (s + 1) % a.rule.length;
        const prevOwner = owner[i];
        const newOwner = a.owner === 255 ? 255 : a.owner + 1;
        owner[i] = newOwner;
        if (prevOwner !== newOwner) {
            events.captures.push({ x: a.x, y: a.y, owner: a.owner });
        }
        // Neighbors зависят от gridType и (для tri/hex) от parity клетки.
        const neighbors = getNeighbors(a.x, a.y, sim.gridType);
        const offset = neighbors[a.dir % neighbors.length];
        const died = applyMove(a, offset[0], offset[1], w, h, sim.topology, numDirs);
        if (died) {
            events.deaths.push({ id: a.id, owner: a.owner, x: a.x, y: a.y });
        }
    }
    // ─── 2. Группировка по клеткам, разрешение коллизий ───────────────────────
    const cellMap = new Map();
    for (const a of ants) {
        if (a.dead)
            continue;
        const k = a.y * w + a.x;
        let list = cellMap.get(k);
        if (!list) {
            list = [];
            cellMap.set(k, list);
        }
        list.push(a);
    }
    const cd = sim.collisionCooldownTicks;
    for (const [, group] of cellMap) {
        if (group.length < 2)
            continue;
        const owners = new Set(group.map((a) => a.owner));
        if (owners.size < 2)
            continue;
        events.collisions.push({
            x: group[0].x,
            y: group[0].y,
            antIds: group.map((a) => a.id),
        });
        // Если HP отключён — фиксируем коллизию как событие, но урона не наносим.
        // Муравьи продолжают двигаться, статистика clashes идёт, для аналитики полезно.
        if (!sim.hpEnabled)
            continue;
        for (const a of group) {
            // Иммунитет после недавнего урона
            if (sim.tick - a.lastDamageTick < cd)
                continue;
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
        if (a.dead)
            continue;
        if (a.lastDamageTick === sim.tick)
            continue; // только что получил damage — пропускаем
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
        const aliveByOwner = new Map();
        for (const a of ants) {
            if (a.dead || a.owner === 255)
                continue;
            let list = aliveByOwner.get(a.owner);
            if (!list) {
                list = [];
                aliveByOwner.set(a.owner, list);
            }
            list.push(a);
        }
        // Сортируем по ownerId для детерминированного порядка обработки
        const sortedOwners = [...aliveByOwner.entries()].sort(([a], [b]) => a - b);
        for (const [ownerId, ownAnts] of sortedOwners) {
            const last = sim.lastBirthTickByOwner[ownerId] ?? -9999;
            if (sim.tick - last < bc.cooldownTicks)
                continue;
            // Лимит per-player или unlimited с глобальным cap
            if (bc.unlimited) {
                const totalAlive = ants.reduce((n, a) => n + (a.dead ? 0 : 1), 0);
                if (totalAlive >= w * h - 1)
                    continue;
            }
            else {
                if (ownAnts.length >= bc.maxAntsPerPlayer)
                    continue;
            }
            // ─── Выбор родителя: МАКСИМУМ своих соседей ─────────────────────────
            // При равенстве — наименьший id (детерминированный tiebreaker).
            let chosen = null;
            let bestCount = -1;
            for (const cand of ownAnts) {
                let cnt = 0;
                for (let dy = -1; dy <= 1; dy++)
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0)
                            continue;
                        const nx = (cand.x + dx + w) % w;
                        const ny = (cand.y + dy + h) % h;
                        if (owner[ny * w + nx] === ownerId + 1)
                            cnt++;
                    }
                if (cnt < bc.minNeighbors)
                    continue;
                if (cnt > bestCount || (cnt === bestCount && chosen && cand.id < chosen.id)) {
                    bestCount = cnt;
                    chosen = cand;
                }
            }
            if (!chosen)
                continue;
            // ─── Клетка рождения: первая свободная по часовой стрелке ───────────
            // Порядок: N (0,-1), NE (1,-1), E (1,0), SE (1,1), S (0,1), SW (-1,1),
            //          W (-1,0), NW (-1,-1)
            const CLOCK_OFFSETS = [
                [0, -1], [1, -1], [1, 0], [1, 1],
                [0, 1], [-1, 1], [-1, 0], [-1, -1],
            ];
            let spot = null;
            for (const [dx, dy] of CLOCK_OFFSETS) {
                const nx = (chosen.x + dx + w) % w;
                const ny = (chosen.y + dy + h) % h;
                if (!ants.some((b) => !b.dead && b.x === nx && b.y === ny)) {
                    spot = { x: nx, y: ny };
                    break;
                }
            }
            if (!spot)
                continue;
            // ─── Решение wild / hybrid / normal — детерминированно ──────────────
            let newOwner = ownerId;
            let newRule = chosen.rule;
            let isHybrid = false;
            let isWild = false;
            // Wild: 5+ разных owner'ов среди 8 соседей клетки рождения
            const neighborOwners = new Set();
            for (const [dx, dy] of CLOCK_OFFSETS) {
                const nx = (spot.x + dx + w) % w;
                const ny = (spot.y + dy + h) % h;
                const o = owner[ny * w + nx];
                if (o !== 0)
                    neighborOwners.add(o);
            }
            if (neighborOwners.size >= 5) {
                newOwner = 255;
                newRule = cyclicShift(chosen.rule, sim.tick % chosen.rule.length);
                isWild = true;
            }
            else {
                // Hybrid: есть муравей другого игрока в радиусе 2 от родителя
                let nearestOther = null;
                let nearestDist = 999;
                for (const other of ants) {
                    if (other.dead || other.owner === ownerId || other.owner === 255)
                        continue;
                    // Чебышёв (по торусу)
                    const ddx = Math.min(Math.abs(other.x - chosen.x), w - Math.abs(other.x - chosen.x));
                    const ddy = Math.min(Math.abs(other.y - chosen.y), h - Math.abs(other.y - chosen.y));
                    const dist = Math.max(ddx, ddy);
                    if (dist > 2)
                        continue;
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
            let mutantCause;
            const m = bc.mutation;
            if (m) {
                // Halo: своих в 8-окрестности клетки рождения
                if (m.haloEnabled) {
                    let own = 0;
                    for (let dy = -1; dy <= 1; dy++)
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0)
                                continue;
                            const nx = (spot.x + dx + w) % w;
                            const ny = (spot.y + dy + h) % h;
                            if (owner[ny * w + nx] === ownerId + 1)
                                own++;
                        }
                    if (own >= m.haloMinNeighbors) {
                        isMutant = true;
                        mutantCause = 'halo';
                    }
                }
                // Mirror: точка рождения симметрична через врага в радиусе R
                if (!isMutant && m.mirrorEnabled) {
                    for (const other of ants) {
                        if (other.dead || other.owner === ownerId || other.owner === 255)
                            continue;
                        const dx = Math.min(Math.abs(spot.x - other.x), w - Math.abs(spot.x - other.x));
                        const dy = Math.min(Math.abs(spot.y - other.y), h - Math.abs(spot.y - other.y));
                        const dist = Math.max(dx, dy);
                        if (dist > m.mirrorRadius)
                            continue;
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
            const newAnt = {
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
            // Stage 6: если reserveMode — муравей идёт в мешок через callback
            // вместо появления на поле. Engine не знает что такое "мешок" — это
            // абстракция уровня UI. Здесь только callback.
            const reserved = bc.reserveMode === true && bc.onReserve !== undefined;
            if (reserved) {
                bc.onReserve(newAnt);
            }
            else {
                ants.push(newAnt);
            }
            sim.lastBirthTickByOwner[ownerId] = sim.tick;
            events.births.push({
                id: newAnt.id, owner: newOwner, x: spot.x, y: spot.y,
                isHybrid, isWild, isMutant, mutantCause, reserved,
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
function cyclicShift(rule, n) {
    if (rule.length <= 1)
        return rule;
    const k = ((n % rule.length) + rule.length) % rule.length;
    return rule.slice(k) + rule.slice(0, k);
}
/** Склеить два правила в одно. Длина не больше 6. Чисто. */
function mixRules(a, b) {
    let out = '';
    const max = Math.min(6, Math.max(a.length, b.length));
    for (let i = 0; i < max; i++) {
        out += a[i % a.length] ?? '';
        if (out.length < 6)
            out += b[i % b.length] ?? '';
        if (out.length >= 6)
            break;
    }
    return out.slice(0, 6);
}
//# sourceMappingURL=engine.js.map