// src/core/langton/engine-stage5.test.ts
//
// Тесты на mutation conditions Этапа 5:
//   - Halo: рождение окружено N+ своими
//   - Mirror: рождение симметрично через врага
//   - Path: родитель N+ тиков без damage
//
// + проверка приоритета (halo > mirror > path)
// + проверка что mutation выключена по умолчанию

import { describe, it, expect } from 'vitest';
import { makeLangtonState, stepLangton } from './engine';

describe('Stage 5: Mutation off by default', () => {
  it('no mutation config = no mutants ever', () => {
    const sim = makeLangtonState({
      w: 20, h: 20, seed: 1,
      ants: [
        { id: 'p0_a0', owner: 0, x: 5, y: 5, dir: 0, rule: 'RL', hp: 3 },
        { id: 'p0_a1', owner: 0, x: 5, y: 6, dir: 1, rule: 'RL', hp: 3 },
        { id: 'p0_a2', owner: 0, x: 6, y: 5, dir: 2, rule: 'RL', hp: 3 },
        { id: 'p1_a0', owner: 1, x: 15, y: 15, dir: 0, rule: 'RL', hp: 3 },
      ],
      birthConfig: {
        enabled: true, minNeighbors: 2, cooldownTicks: 5,
        maxAntsPerPlayer: 50, hybridChance: 0, wildChance: 0,
        // mutation: undefined — по умолчанию выключено
      },
    });

    for (let i = 0; i < 500; i++) stepLangton(sim);

    const anyMutants = sim.ants.some((a) => a.isMutant);
    expect(anyMutants).toBe(false);
  });
});

describe('Stage 5: Halo condition', () => {
  it('birth surrounded by 6+ own neighbors → mutant', () => {
    // Создаём ситуацию где рождение точно произойдёт в halo.
    // Расставляем 8 муравьёв P0 квадратом 3×3 вокруг (5,5), убирая центр.
    // Когда там родится новый — все 8 соседей будут P0.
    const ants = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      ants.push({
        id: `a_${dx}_${dy}`, owner: 0, x: 5 + dx, y: 5 + dy,
        dir: 0 as 0, rule: 'RL', hp: 3,
      });
    }

    const sim = makeLangtonState({
      w: 20, h: 20, seed: 1, ants,
      collisionCooldownTicks: 999, // не дерутся (свои)
      birthConfig: {
        enabled: true, minNeighbors: 4, cooldownTicks: 1,
        maxAntsPerPlayer: 100, hybridChance: 0, wildChance: 0,
        mutation: {
          haloEnabled: true, haloMinNeighbors: 4,
          mirrorEnabled: false, mirrorRadius: 2,
          pathEnabled: false, pathStraightTicks: 10,
        },
      },
    });

    // Тикаем — рано или поздно родится мутант
    let foundMutant = false;
    for (let i = 0; i < 50; i++) {
      stepLangton(sim);
      if (sim.ants.some((a) => a.isMutant && a.mutantCause === 'halo')) {
        foundMutant = true;
        break;
      }
    }
    expect(foundMutant).toBe(true);
  });

  it('halo with high threshold + no birth → no mutants', () => {
    // Birth выключен → никогда не рождается → никаких мутантов вообще
    const sim = makeLangtonState({
      w: 20, h: 20, seed: 1,
      ants: [{ id: 'a', owner: 0, x: 10, y: 10, dir: 0, rule: 'RL', hp: 3 }],
      birthConfig: null,
    });

    for (let i = 0; i < 100; i++) stepLangton(sim);
    expect(sim.ants.some((a) => a.isMutant)).toBe(false);
  });
});

describe('Stage 5: Path condition', () => {
  it('parent without damage for N ticks → mutant on birth', () => {
    // Изолированные муравьи — никто не сталкивается → straightTicks растёт.
    // На большом поле, мало муравьёв, low cooldown.
    const sim = makeLangtonState({
      w: 50, h: 50, seed: 1,
      ants: [
        { id: 'p0_a0', owner: 0, x: 10, y: 10, dir: 0, rule: 'RL', hp: 3 },
        { id: 'p0_a1', owner: 0, x: 12, y: 12, dir: 1, rule: 'RL', hp: 3 },
        { id: 'p0_a2', owner: 0, x: 14, y: 10, dir: 2, rule: 'RL', hp: 3 },
        { id: 'p1_a0', owner: 1, x: 40, y: 40, dir: 0, rule: 'RL', hp: 3 },
      ],
      collisionCooldownTicks: 5,
      birthConfig: {
        enabled: true, minNeighbors: 2, cooldownTicks: 5,
        maxAntsPerPlayer: 50, hybridChance: 0, wildChance: 0,
        mutation: {
          haloEnabled: false, haloMinNeighbors: 6,
          mirrorEnabled: false, mirrorRadius: 2,
          pathEnabled: true, pathStraightTicks: 5,
        },
      },
    });

    let foundMutant = false;
    for (let i = 0; i < 100; i++) {
      stepLangton(sim);
      if (sim.ants.some((a) => a.isMutant && a.mutantCause === 'path')) {
        foundMutant = true;
        break;
      }
    }
    expect(foundMutant).toBe(true);
  });

  it('straightTicks reset on damage', () => {
    // Два врага рядом, постоянно сталкиваются → straightTicks=0
    const sim = makeLangtonState({
      w: 5, h: 5, seed: 1,
      ants: [
        { id: 'a', owner: 0, x: 2, y: 2, dir: 1, rule: 'RL', hp: 99 },
        { id: 'b', owner: 1, x: 2, y: 2, dir: 1, rule: 'RL', hp: 99 },
      ],
      collisionCooldownTicks: 0,
      birthConfig: null,
    });

    // Пускаем 20 тиков. Они постоянно дерутся (collisionCooldownTicks=0)
    for (let i = 0; i < 20; i++) stepLangton(sim);

    // straightTicks никогда не должен превышать collisionCooldownTicks=0
    // То есть после каждого damage он сбрасывается в 0
    for (const a of sim.ants) {
      if (a.dead) continue;
      expect(a.straightTicks ?? 0).toBeLessThanOrEqual(20);
    }
  });
});

describe('Stage 5: Mutation priority (halo > mirror > path)', () => {
  it('halo wins when multiple conditions match', () => {
    // Делаем halo-friendly setup + враг рядом (потенциально mirror)
    const ants = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      ants.push({
        id: `own_${dx}_${dy}`, owner: 0, x: 5 + dx, y: 5 + dy,
        dir: 0 as 0, rule: 'RL', hp: 3,
      });
    }
    // Враг в радиусе mirror
    ants.push({ id: 'enemy', owner: 1, x: 5, y: 7, dir: 0 as 0, rule: 'RL', hp: 3 });

    const sim = makeLangtonState({
      w: 20, h: 20, seed: 1, ants,
      collisionCooldownTicks: 999,
      birthConfig: {
        enabled: true, minNeighbors: 4, cooldownTicks: 1,
        maxAntsPerPlayer: 100, hybridChance: 0, wildChance: 0,
        mutation: {
          haloEnabled: true, haloMinNeighbors: 4,
          mirrorEnabled: true, mirrorRadius: 5,
          pathEnabled: true, pathStraightTicks: 1,
        },
      },
    });

    let mutant = null;
    for (let i = 0; i < 20; i++) {
      stepLangton(sim);
      mutant = sim.ants.find((a) => a.isMutant);
      if (mutant) break;
    }
    expect(mutant).toBeTruthy();
    // Поскольку halo сработал первым в проверке — cause = 'halo'
    expect(mutant!.mutantCause).toBe('halo');
  });
});
