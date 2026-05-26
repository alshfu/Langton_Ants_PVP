// src/core/langton/engine-stage6.test.ts
//
// Тесты Stage 6: reserve mode в engine.
// Проверяем что:
//  - reserveMode=false (default) — birth работает как раньше
//  - reserveMode=true + onReserve — newborn НЕ попадает на поле
//  - onReserve вызывается с правильным newborn
//  - events.births[].reserved === true когда newborn в мешок

import { describe, it, expect } from 'vitest';
import { makeLangtonState, stepLangton } from './engine';
import type { Ant } from './engine';

describe('Stage 6: reserveMode = false (default behavior)', () => {
  it('births go on field as before', () => {
    const sim = makeLangtonState({
      w: 20, h: 20, seed: 1,
      ants: [
        { id: 'p0_a0', owner: 0, x: 5, y: 5, dir: 0, rule: 'RL', hp: 3 },
        { id: 'p0_a1', owner: 0, x: 5, y: 6, dir: 1, rule: 'RL', hp: 3 },
        { id: 'p0_a2', owner: 0, x: 6, y: 5, dir: 2, rule: 'RL', hp: 3 },
      ],
      birthConfig: {
        enabled: true, minNeighbors: 2, cooldownTicks: 1,
        maxAntsPerPlayer: 100, hybridChance: 0, wildChance: 0,
        // reserveMode: undefined / false
      },
    });

    const initialCount = sim.ants.length;
    for (let i = 0; i < 100; i++) stepLangton(sim);

    // Должны появиться новые муравьи на поле
    expect(sim.ants.length).toBeGreaterThan(initialCount);
  });
});

describe('Stage 6: reserveMode = true', () => {
  it('births do NOT appear on field — go to onReserve callback', () => {
    const reserved: Ant[] = [];
    const sim = makeLangtonState({
      w: 20, h: 20, seed: 1,
      ants: [
        { id: 'p0_a0', owner: 0, x: 5, y: 5, dir: 0, rule: 'RL', hp: 3 },
        { id: 'p0_a1', owner: 0, x: 5, y: 6, dir: 1, rule: 'RL', hp: 3 },
        { id: 'p0_a2', owner: 0, x: 6, y: 5, dir: 2, rule: 'RL', hp: 3 },
      ],
      birthConfig: {
        enabled: true, minNeighbors: 2, cooldownTicks: 1,
        maxAntsPerPlayer: 100, hybridChance: 0, wildChance: 0,
        reserveMode: true,
        onReserve: (ant) => reserved.push(ant),
      },
    });

    const initialCount = sim.ants.length;
    for (let i = 0; i < 100; i++) stepLangton(sim);

    // На поле — те же 3 муравья (никто не родился на поле)
    expect(sim.ants.length).toBe(initialCount);
    // Но в мешок что-то попало
    expect(reserved.length).toBeGreaterThan(0);
  });

  it('events.births have reserved=true flag', () => {
    const sim = makeLangtonState({
      w: 20, h: 20, seed: 1,
      ants: [
        { id: 'p0_a0', owner: 0, x: 5, y: 5, dir: 0, rule: 'RL', hp: 3 },
        { id: 'p0_a1', owner: 0, x: 5, y: 6, dir: 1, rule: 'RL', hp: 3 },
        { id: 'p0_a2', owner: 0, x: 6, y: 5, dir: 2, rule: 'RL', hp: 3 },
      ],
      birthConfig: {
        enabled: true, minNeighbors: 2, cooldownTicks: 1,
        maxAntsPerPlayer: 100, hybridChance: 0, wildChance: 0,
        reserveMode: true,
        onReserve: () => {},
      },
    });

    let foundReservedBirth = false;
    for (let i = 0; i < 100; i++) {
      const ev = stepLangton(sim);
      for (const birth of ev.births) {
        if (birth.reserved === true) {
          foundReservedBirth = true;
          break;
        }
      }
      if (foundReservedBirth) break;
    }
    expect(foundReservedBirth).toBe(true);
  });

  it('onReserve receives valid Ant objects with all properties', () => {
    const reserved: Ant[] = [];
    const sim = makeLangtonState({
      w: 20, h: 20, seed: 1,
      ants: [
        { id: 'p0_a0', owner: 0, x: 5, y: 5, dir: 0, rule: 'RL', hp: 3 },
        { id: 'p0_a1', owner: 0, x: 5, y: 6, dir: 1, rule: 'RL', hp: 3 },
        { id: 'p0_a2', owner: 0, x: 6, y: 5, dir: 2, rule: 'RL', hp: 3 },
      ],
      birthConfig: {
        enabled: true, minNeighbors: 2, cooldownTicks: 1,
        maxAntsPerPlayer: 100, hybridChance: 0, wildChance: 0,
        reserveMode: true,
        onReserve: (ant) => reserved.push(ant),
      },
    });

    for (let i = 0; i < 100; i++) stepLangton(sim);

    expect(reserved.length).toBeGreaterThan(0);
    const first = reserved[0]!;
    expect(first.id).toMatch(/^birth_/);
    expect(first.owner).toBe(0);
    expect(first.hp).toBeGreaterThan(0);
    expect(first.rule).toBeTruthy();
    expect(typeof first.x).toBe('number');
    expect(typeof first.y).toBe('number');
    expect(first.dead).toBeFalsy();
  });

  it('engine is still deterministic with reserve mode', () => {
    // Тот же setup, два прогона должны дать одинаковые reserved
    function run() {
      const reserved: Ant[] = [];
      const sim = makeLangtonState({
        w: 20, h: 20, seed: 1,
        ants: [
          { id: 'p0_a0', owner: 0, x: 5, y: 5, dir: 0, rule: 'RL', hp: 3 },
          { id: 'p0_a1', owner: 0, x: 5, y: 6, dir: 1, rule: 'RL', hp: 3 },
          { id: 'p0_a2', owner: 0, x: 6, y: 5, dir: 2, rule: 'RL', hp: 3 },
        ],
        birthConfig: {
          enabled: true, minNeighbors: 2, cooldownTicks: 1,
          maxAntsPerPlayer: 100, hybridChance: 0, wildChance: 0,
          reserveMode: true,
          onReserve: (ant) => reserved.push(ant),
        },
      });
      for (let i = 0; i < 200; i++) stepLangton(sim);
      return reserved.map((a) => `${a.id}|${a.x}|${a.y}|${a.dir}|${a.owner}`).join('\n');
    }
    const r1 = run();
    const r2 = run();
    expect(r1).toBe(r2);
    expect(r1.length).toBeGreaterThan(0);
  });
});
