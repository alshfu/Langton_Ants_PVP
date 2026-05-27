# Backend birth.ts — pre-Stage-3 PRNG-based design (historical)

Этот файл — 106-строчный pseudocode из backend/core/src/langton/birth.ts.
Описывал NON-DETERMINISTIC алгоритм рождения через sim.rng().
Заменён в Stage 3 на детерминированный алгоритм (max own neighbors).
Перенесён сюда 2026-05-28 в Day 1 Stage 8 — engine workspace refactor.

## Original content

```typescript
// core/src/langton/birth.ts
//
// Логика рождения новых муравьёв (births), гибридов (hybrids) и диких (wilds).
//
// Этот файл вынесен из engine.ts чтобы держать stepLangton() читаемым.
// Вызывается из stepLangton после resolveCollisions, если birthConfig включён.
//
// ─────────────────────────────────────────────────────────────────────────────
// Алгоритм рождения (см. backend §5.4 и interface-contract.md §4.6)
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. Сгруппировать живых муравьёв по owner (Map<number, Ant[]>)
// 2. Для каждого owner:
//    a) Проверить cooldown:
//         sim.tick - sim.lastBirthTickByOwner[owner] < bc.cooldownTicks → skip
//    b) Проверить лимит:
//         ants_alive_of_owner >= bc.maxAntsPerPlayer → skip
//    c) Найти кандидата:
//         Случайно сэмплировать ~3 муравья из owner-pool.
//         Для каждого посчитать N своих соседних клеток (8-cell ring).
//         Если N >= bc.minNeighbors → это кандидат.
//    d) Найти свободную соседнюю клетку:
//         Из 8 соседей кандидата отфильтровать те, где НЕ стоит живой муравей.
//         Случайно выбрать одну. Если пусто → skip.
//    e) Кинуть кубик (sim.rng()):
//         < bc.wildChance → wild birth (owner=255)
//         < bc.wildChance + bc.hybridChance → hybrid (склеить правила двух разных owners)
//         иначе → обычное рождение (правило кандидата)
//    f) Создать нового муравья:
//         id: `${parentId}_b${sim.tick}` или `wild_${sim.tick}`
//         owner: newOwner
//         x, y: координаты найденного места
//         dir: случайное 0..3
//         rule: newRule
//         hp: 3, maxHp: 3
//         lastDamageTick: -9999, bornAt: sim.tick
//         isHybrid?: true, isWild?: true
//    g) Запушить в sim.ants, обновить sim.lastBirthTickByOwner[owner]
//    h) Добавить в events.births (и в events.hybrids/wilds если применимо)
//
// ─────────────────────────────────────────────────────────────────────────────

import type { Ant, SimState, BirthConfig } from './engine';

/** Один результат обработки births для одного owner за тик. */
export interface BirthOutcome {
  /** Если родился — сюда. null если skip по любой причине. */
  newAnt: Ant | null;
  /** Гибрид? */
  isHybrid: boolean;
  /** Дикий? */
  isWild: boolean;
  /** Родители (для logging и replay). */
  parentIds: string[];
}

/**
 * Обработать рождения для одного тика. Мутирует sim.
 * Возвращает массив outcomes — по одному на каждый успешный birth.
 */
export function processBirths(_sim: SimState, _bc: BirthConfig): BirthOutcome[] {
  // TODO: реализовать по алгоритму в шапке файла
  throw new Error('processBirths not implemented');
}

/**
 * Подсчитать клетки данного owner среди 8 соседей точки (x,y).
 * Соседство тороидальное (wrap-around).
 */
export function countOwnNeighbors(_sim: SimState, _x: number, _y: number, _owner: number): number {
  // TODO: реализовать
  throw new Error('countOwnNeighbors not implemented');
}

/**
 * Найти свободные соседние клетки (где нет живых муравьёв).
 * Возвращает массив координат, может быть пустым.
 */
export function findFreeNeighborCells(
  _sim: SimState,
  _x: number,
  _y: number,
): Array<{ x: number; y: number }> {
  // TODO: реализовать
  throw new Error('findFreeNeighborCells not implemented');
}

/**
 * Склеить два правила в гибрид.
 * Простейшая стратегия: чередовать символы.
 * Например: 'RL' + 'LRR' → 'RLLRR' (1-я буква первого, 1-я второго, 2-я первого, 2-я второго, ...).
 * Длина гибрида не должна превышать 6.
 */
export function mixRules(_a: string, _b: string): string {
  // TODO: реализовать
  throw new Error('mixRules not implemented');
}

/**
 * Сгенерировать "перемешанное" правило для дикого муравья.
 * Стратегия: взять родительское правило и переставить буквы в случайном порядке.
 */
export function scrambleRule(_rule: string, _rng: () => number): string {
  // TODO: реализовать
  throw new Error('scrambleRule not implemented');
}
```
