// src/core/langton/engine-stage2.test.ts
//
// Тесты на новые фичи Этапа 2: GC мёртвых, unlimited ants.

import { describe, it, expect } from 'vitest';
import { makeLangtonState, stepLangton } from './engine';

describe('engine Stage 2: GC dead ants', () => {
  it('GC fires every 200 ticks, removes dead from ants array', () => {
    // Создаём situation где гарантированно будут смерти
    const sim = makeLangtonState({
      w: 10, h: 10, seed: 1,
      ants: [
        // 4 муравья в одной клетке — гарантированная драка
        { id: 'a', owner: 0, x: 5, y: 5, dir: 0, rule: 'RL', hp: 1 },
        { id: 'b', owner: 1, x: 5, y: 5, dir: 0, rule: 'RL', hp: 1 },
        { id: 'c', owner: 2, x: 5, y: 5, dir: 0, rule: 'RL', hp: 1 },
        { id: 'd', owner: 3, x: 5, y: 5, dir: 0, rule: 'RL', hp: 1 },
      ],
      collisionCooldownTicks: 0,
      birthConfig: null,
    });

    // На первом тике гарантированно: clash → каждый -1 HP → все мертвы
    stepLangton(sim);

    // Проверка: dead-флаги выставлены, но в массиве пока 4 элемента
    const aliveAfterTick1 = sim.ants.filter((a) => !a.dead).length;
    expect(aliveAfterTick1).toBe(0);
    expect(sim.ants.length).toBe(4);

    // Дотикаем до tick=200 — GC должен сработать
    for (let i = 1; i < 200; i++) stepLangton(sim);
    expect(sim.tick).toBe(200);
    // После GC массив очищен от мёртвых
    expect(sim.ants.length).toBe(0);
  });
});

describe('engine Stage 2: unlimited birth', () => {
  it('with unlimited=true, maxAntsPerPlayer is ignored', () => {
    const sim = makeLangtonState({
      w: 30, h: 30, seed: 42,
      ants: [
        { id: 'p0_a0', owner: 0, x: 5, y: 5, dir: 0, rule: 'RL', hp: 3 },
        { id: 'p0_a1', owner: 0, x: 5, y: 6, dir: 1, rule: 'RL', hp: 3 },
        { id: 'p0_a2', owner: 0, x: 6, y: 5, dir: 2, rule: 'RL', hp: 3 },
        { id: 'p1_a0', owner: 1, x: 25, y: 25, dir: 0, rule: 'RL', hp: 3 },
      ],
      birthConfig: {
        enabled: true,
        minNeighbors: 2,
        cooldownTicks: 5,
        maxAntsPerPlayer: 5,   // низкий лимит
        hybridChance: 0,
        wildChance: 0,
        unlimited: true,        // ★ но unlimited включён
      },
    });

    for (let i = 0; i < 500; i++) stepLangton(sim);

    const aliveByOwner = new Map<number, number>();
    for (const a of sim.ants) {
      if (a.dead) continue;
      aliveByOwner.set(a.owner, (aliveByOwner.get(a.owner) ?? 0) + 1);
    }
    const p0Alive = aliveByOwner.get(0) ?? 0;
    // Если бы лимит работал — было бы максимум 5. С unlimited — больше.
    expect(p0Alive).toBeGreaterThan(5);
  });

  it('with unlimited=true, global cap = w*h - 1 holds', () => {
    const sim = makeLangtonState({
      w: 5, h: 5, seed: 1,
      ants: [
        { id: 'p0_a0', owner: 0, x: 1, y: 1, dir: 0, rule: 'RL', hp: 3 },
        { id: 'p0_a1', owner: 0, x: 1, y: 2, dir: 1, rule: 'RL', hp: 3 },
        { id: 'p0_a2', owner: 0, x: 2, y: 1, dir: 2, rule: 'RL', hp: 3 },
      ],
      collisionCooldownTicks: 100, // не дерутся
      birthConfig: {
        enabled: true, minNeighbors: 1, cooldownTicks: 1,
        maxAntsPerPlayer: 9999, hybridChance: 0, wildChance: 0,
        unlimited: true,
      },
    });

    for (let i = 0; i < 1000; i++) stepLangton(sim);

    const alive = sim.ants.reduce((n, a) => n + (a.dead ? 0 : 1), 0);
    // Глобальный cap = 5*5 - 1 = 24
    expect(alive).toBeLessThanOrEqual(24);
  });
});
