// src/lib/simSnapshot.ts
//
// Сохранение/восстановление полного состояния симуляции.
// Используется для step back: храним snapshot'ы каждые N тиков, при откате
// восстанавливаем ближайший snapshot и прогоняем нужное число тиков вперёд.

import type { SimState, Ant } from '@core/langton/engine';

export interface SimSnapshot {
  tick: number;
  ownerCopy: Uint8Array;
  stateCopy: Uint8Array;
  antsCopy: Ant[];
  lastBirthTickByOwner: Record<number, number>;
  /** Stage 6: состояние мешков на момент snapshot (key=playerIdx). */
  reserveCopy?: Map<number, Ant[]>;
}

/**
 * Глубокая копия sim для последующего восстановления.
 * NOTE: rng не копируется — он не используется в детерминированном движке.
 *
 * Stage 6: можно передать reserveByPlayer чтобы записать в snapshot.
 */
export function snapshot(
  sim: SimState,
  reserveByPlayer?: Map<number, Ant[]>,
): SimSnapshot {
  const snap: SimSnapshot = {
    tick: sim.tick,
    ownerCopy: new Uint8Array(sim.owner),
    stateCopy: new Uint8Array(sim.state),
    antsCopy: sim.ants.map((a) => ({ ...a })),
    lastBirthTickByOwner: { ...sim.lastBirthTickByOwner },
  };
  if (reserveByPlayer) {
    snap.reserveCopy = new Map();
    reserveByPlayer.forEach((ants, k) => {
      snap.reserveCopy!.set(k, ants.map((a) => ({ ...a })));
    });
  }
  return snap;
}

/**
 * Восстановить sim из snapshot. Перезаписывает поля in-place.
 * Stage 6: если в snapshot есть reserve — он применяется к переданной Map.
 */
export function restore(
  sim: SimState,
  snap: SimSnapshot,
  reserveByPlayer?: Map<number, Ant[]>,
): void {
  sim.tick = snap.tick;
  if (sim.owner.length === snap.ownerCopy.length) {
    sim.owner.set(snap.ownerCopy);
    sim.state.set(snap.stateCopy);
  }
  sim.ants = snap.antsCopy.map((a) => ({ ...a }));
  sim.lastBirthTickByOwner = { ...snap.lastBirthTickByOwner };
  // Stage 6: восстанавливаем reserve если был сохранён
  if (reserveByPlayer && snap.reserveCopy) {
    reserveByPlayer.clear();
    snap.reserveCopy.forEach((ants, k) => {
      reserveByPlayer.set(k, ants.map((a) => ({ ...a })));
    });
  }
}

/**
 * Менеджер snapshot'ов с фиксированным шагом. Хранит до maxSnapshots последних.
 */
export class SnapshotHistory {
  private items: SimSnapshot[] = [];
  private intervalTicks: number;
  private maxSnapshots: number;

  constructor(intervalTicks = 100, maxSnapshots = 100) {
    this.intervalTicks = intervalTicks;
    this.maxSnapshots = maxSnapshots;
  }

  /** Вызывается на каждом тике. Сохраняет snapshot когда tick % interval === 0. */
  maybeCapture(sim: SimState, reserveByPlayer?: Map<number, Ant[]>): void {
    if (sim.tick % this.intervalTicks !== 0) return;
    this.items.push(snapshot(sim, reserveByPlayer));
    while (this.items.length > this.maxSnapshots) this.items.shift();
  }

  /** Принудительно сохранить (например, в начале симуляции при tick=0). */
  capture(sim: SimState, reserveByPlayer?: Map<number, Ant[]>): void {
    this.items.push(snapshot(sim, reserveByPlayer));
    while (this.items.length > this.maxSnapshots) this.items.shift();
  }

  /**
   * Найти snapshot с tick <= targetTick. Возвращает null если нет подходящего.
   */
  findNearest(targetTick: number): SimSnapshot | null {
    let best: SimSnapshot | null = null;
    for (const s of this.items) {
      if (s.tick <= targetTick && (!best || s.tick > best.tick)) best = s;
    }
    return best;
  }

  /** Очистить всю историю (при reset). */
  clear(): void {
    this.items = [];
  }

  /** Сколько snapshot'ов записано. */
  get size(): number {
    return this.items.length;
  }

  /** Есть ли хоть один snapshot — для UI чтобы понять можно ли откатить. */
  get hasAny(): boolean {
    return this.items.length > 0;
  }
}
