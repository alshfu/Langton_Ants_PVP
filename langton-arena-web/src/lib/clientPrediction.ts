// src/lib/clientPrediction.ts
//
// Stage 8 Day 10 — client-side prediction reconciliation helpers.
//
// Pure functions для управления ghost-deploy'ями: оптимистичные
// placeholder'ы, отображаемые на канвасе мгновенно после click'а, до
// подтверждения сервером через match_tick.deploys.
//
// Lifecycle ghost'а:
//   1. addGhost()    — push в pendingGhosts при click → отправке deploy
//   2. reconcileGhosts() — на match_tick.deploys: matching (FIFO) ghosts
//      удаляются, реальные ant'ы из engine заменяют их визуально
//   3. rejectGhost() — на error('INVALID_DEPLOY'|'INPUT_TOO_OLD') с
//      контекстом x/y: матчинг ghost удаляется
//   4. gcStaleGhosts() — на каждом match_tick: ghost'ы старше maxAgeTicks
//      удаляются (защита от silent reject / lost packets)

import type { DeployAction } from '@langton/core';

export interface Ghost {
  /** Локальный UUID, уникален per click. */
  id: string;
  x: number;
  y: number;
  playerIdx: number;
  /** Server tick на момент send (для GC по возрасту). */
  sentAtTick: number;
  /** Wall-clock ms на момент send (для будущего RTT measurement). */
  sentAtMs: number;
}

/** Создать новый ghost. Чистый helper для consistency UUID format. */
export function makeGhost(
  x: number,
  y: number,
  playerIdx: number,
  sentAtTick: number,
  sentAtMs: number = Date.now(),
): Ghost {
  return {
    id: `ghost-${sentAtMs}-${Math.random().toString(36).slice(2, 8)}`,
    x, y, playerIdx,
    sentAtTick,
    sentAtMs,
  };
}

/** Push ghost в array (immutable, для useState setter). */
export function addGhost(ghosts: readonly Ghost[], ghost: Ghost): Ghost[] {
  return [...ghosts, ghost];
}

/**
 * Reconcile: убирает confirmed ghost'ы (matching через (playerIdx, x, y)).
 * FIFO — при множественных predictions в одну клетку удаляется самый старый.
 * Возвращает тот же array (по reference) если ничего не изменилось — для
 * избежания лишних React re-renders.
 */
export function reconcileGhosts(
  ghosts: readonly Ghost[],
  confirmedDeploys: readonly DeployAction[],
): Ghost[] {
  if (ghosts.length === 0 || confirmedDeploys.length === 0) {
    return ghosts as Ghost[];
  }
  const result: Ghost[] = [...ghosts];
  let changed = false;
  for (const d of confirmedDeploys) {
    const idx = result.findIndex(
      (g) => g.playerIdx === d.playerIdx && g.x === d.x && g.y === d.y,
    );
    if (idx >= 0) {
      result.splice(idx, 1);
      changed = true;
    }
  }
  return changed ? result : (ghosts as Ghost[]);
}

/**
 * Reject: убирает ghost, соответствующий rejected deploy.
 * Возвращает [newGhosts, removedGhost | null].
 * Если context.x/y не заданы — ничего не делает (нельзя матчить).
 */
export function rejectGhost(
  ghosts: readonly Ghost[],
  myPlayerIdx: number | null,
  context: { x?: number; y?: number; tick?: number } | undefined,
): { ghosts: Ghost[]; removed: Ghost | null } {
  if (
    ghosts.length === 0 ||
    myPlayerIdx == null ||
    context?.x == null ||
    context?.y == null
  ) {
    return { ghosts: ghosts as Ghost[], removed: null };
  }
  const idx = ghosts.findIndex(
    (g) => g.x === context.x && g.y === context.y && g.playerIdx === myPlayerIdx,
  );
  if (idx < 0) return { ghosts: ghosts as Ghost[], removed: null };
  const next = [...ghosts];
  const [removed] = next.splice(idx, 1);
  return { ghosts: next, removed: removed ?? null };
}

/**
 * Garbage collect: удаляет ghost'ы старше cutoff (sentAtTick < currentTick - maxAgeTicks).
 * Default maxAgeTicks = 30 (3 секунды @ 10 TPS).
 */
export function gcStaleGhosts(
  ghosts: readonly Ghost[],
  currentTick: number,
  maxAgeTicks: number = 30,
): Ghost[] {
  if (ghosts.length === 0) return ghosts as Ghost[];
  const cutoff = currentTick - maxAgeTicks;
  const next = ghosts.filter((g) => g.sentAtTick >= cutoff);
  return next.length === ghosts.length ? (ghosts as Ghost[]) : next;
}
