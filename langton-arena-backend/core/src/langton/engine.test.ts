// src/core/langton/engine.test.ts
//
// Тесты на детерминизм и базовое поведение движка.

import { describe, it, expect } from 'vitest';
import { makeLangtonState, stepLangton, type MakeStateConfig } from './engine';

function buildSampleConfig(seed: number): MakeStateConfig {
  return {
    w: 50, h: 40, seed,
    ants: [
      { id: 'a0', owner: 0, x: 10, y: 10, dir: 0, rule: 'RL',  hp: 3 },
      { id: 'a1', owner: 1, x: 25, y: 25, dir: 1, rule: 'LRR', hp: 3 },
      { id: 'a2', owner: 2, x: 40, y: 10, dir: 2, rule: 'RLR', hp: 3 },
      { id: 'a3', owner: 3, x: 25, y: 38, dir: 3, rule: 'LR',  hp: 3 },
    ],
    collisionCooldownTicks: 5,
    birthConfig: {
      enabled: true, minNeighbors: 3, cooldownTicks: 50,
      maxAntsPerPlayer: 12, hybridChance: 0.10, wildChance: 0.03,
    },
  };
}

describe('langton engine determinism', () => {
  it('same seed produces identical state after 200 ticks', () => {
    const a = makeLangtonState(buildSampleConfig(42));
    const b = makeLangtonState(buildSampleConfig(42));
    for (let i = 0; i < 200; i++) {
      stepLangton(a);
      stepLangton(b);
    }
    expect(a.tick).toBe(b.tick);
    expect(a.ants.length).toBe(b.ants.length);
    for (let i = 0; i < a.ants.length; i++) {
      expect(a.ants[i]!.x).toBe(b.ants[i]!.x);
      expect(a.ants[i]!.y).toBe(b.ants[i]!.y);
      expect(a.ants[i]!.hp).toBe(b.ants[i]!.hp);
      expect(a.ants[i]!.dead ?? false).toBe(b.ants[i]!.dead ?? false);
    }
    // Owner-grid тоже должен совпадать
    for (let i = 0; i < a.owner.length; i++) {
      expect(a.owner[i]).toBe(b.owner[i]);
    }
  });

  it('engine is fully deterministic on initial state (seed no longer matters)', () => {
    // После Этапа 3 День 1 — движок не использует rng. Только начальное
    // состояние определяет ход симуляции. Разные seed → ТОТ ЖЕ результат
    // если начальные муравьи одинаковые.
    const a = makeLangtonState(buildSampleConfig(42));
    const b = makeLangtonState(buildSampleConfig(99));
    for (let i = 0; i < 100; i++) {
      stepLangton(a);
      stepLangton(b);
    }
    // Owner-grid должен совпадать
    for (let i = 0; i < a.owner.length; i++) {
      expect(a.owner[i]).toBe(b.owner[i]);
    }
    expect(a.ants.length).toBe(b.ants.length);
  });

  it('different initial positions produce different simulation outcomes', () => {
    // Зато разные стартовые позиции дают разные результаты — это всегда так.
    const a = makeLangtonState(buildSampleConfig(42));
    const bConfig = buildSampleConfig(42);
    bConfig.ants[0]!.x += 5; // сдвигаем одного муравья
    const b = makeLangtonState(bConfig);
    for (let i = 0; i < 100; i++) {
      stepLangton(a);
      stepLangton(b);
    }
    let differs = 0;
    for (let i = 0; i < a.owner.length; i++) {
      if (a.owner[i] !== b.owner[i]) differs++;
    }
    expect(differs).toBeGreaterThan(0);
  });

  it('damage cap: clash of 4 enemies takes only 1 HP', () => {
    const sim = makeLangtonState({
      w: 10, h: 10, seed: 1,
      ants: [
        { id: 'p0', owner: 0, x: 5, y: 4, dir: 2, rule: 'RL', hp: 3 }, // подходит сверху
        { id: 'p1', owner: 1, x: 5, y: 6, dir: 0, rule: 'RL', hp: 3 }, // подходит снизу
        { id: 'p2', owner: 2, x: 4, y: 5, dir: 1, rule: 'RL', hp: 3 }, // подходит слева
        { id: 'p3', owner: 3, x: 6, y: 5, dir: 3, rule: 'RL', hp: 3 }, // подходит справа
      ],
      collisionCooldownTicks: 5,
      birthConfig: null,
    });
    // На 1-м тике все 4 окажутся в (5,5) и подерутся
    stepLangton(sim);
    // Каждый должен потерять максимум 1 HP — поэтому hp >= 2
    for (const a of sim.ants) {
      expect(a.hp).toBeGreaterThanOrEqual(2);
    }
  });

  it('torus wrap-around: ant at x=w-1 moving E ends at x=0', () => {
    const sim = makeLangtonState({
      w: 10, h: 10, seed: 1,
      ants: [{ id: 'a', owner: 0, x: 9, y: 5, dir: 1, rule: 'NN', hp: 3 }],
    });
    // Правило 'NN' даёт неподдерживаемый символ. Используем минимальное движение.
    // Реальная проверка: после шага координата x должна wrap'нуться
    stepLangton(sim);
    expect(sim.ants[0]!.x).toBe(0); // x=9 + dir E (1) wrap'нуто
  });

  it('birth disabled: no new ants ever appear', () => {
    const sim = makeLangtonState({
      w: 30, h: 30, seed: 7,
      ants: [
        { id: 'p0_a0', owner: 0, x: 10, y: 10, dir: 0, rule: 'RL', hp: 3 },
        { id: 'p1_a0', owner: 1, x: 20, y: 20, dir: 0, rule: 'RL', hp: 3 },
      ],
      birthConfig: null,
    });
    const initialCount = sim.ants.length;
    for (let i = 0; i < 500; i++) stepLangton(sim);
    expect(sim.ants.length).toBe(initialCount);
  });
});
