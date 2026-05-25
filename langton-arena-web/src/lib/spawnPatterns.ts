// src/lib/spawnPatterns.ts
//
// Чистые функции генерации координат стартовых муравьёв.
// Никаких импортов из React. Детерминизм через переданный seed.

import { mulberry32 } from '@core/langton/prng';
import type { SandboxAntConfig, SpawnPattern } from '@core/contract/state';

export interface SpawnContext {
  /** Индекс игрока в массиве players (0-based). */
  playerIndex: number;
  /** Общее количество игроков. */
  totalPlayers: number;
  /** Ширина и высота поля. */
  fieldW: number;
  fieldH: number;
  /** Сколько муравьёв нужно сгенерировать. */
  antCount: number;
  /** Seed для детерминированного random. */
  seed: number;
}

/**
 * Главная функция — диспатч по pattern.
 * Возвращает массив SandboxAntConfig с id формата p{i}_a{j}.
 * Для 'manual' возвращает пустой массив (расстановка вручную через UI).
 */
export function generateAnts(pattern: SpawnPattern, ctx: SpawnContext): SandboxAntConfig[] {
  if (pattern === 'manual' || ctx.antCount <= 0) return [];
  switch (pattern) {
    case 'radial':  return spawnRadial(ctx);
    case 'corner':  return spawnCorner(ctx);
    case 'cluster': return spawnCluster(ctx);
    case 'center':  return spawnCenter(ctx);
    case 'random':  return spawnRandom(ctx);
    default: {
      const _exhaustive: never = pattern;
      void _exhaustive;
      return [];
    }
  }
}

// ─── Реализации ──────────────────────────────────────────────────────────────

function spawnRadial(ctx: SpawnContext): SandboxAntConfig[] {
  const { playerIndex, totalPlayers, fieldW, fieldH, antCount } = ctx;
  const cx = fieldW / 2;
  const cy = fieldH / 2;
  const radius = Math.min(fieldW, fieldH) * 0.35;
  const ants: SandboxAntConfig[] = [];

  for (let i = 0; i < antCount; i++) {
    // Распределяем муравьёв по сектору игрока.
    // Сектор: 2π / totalPlayers. Внутри — равномерно по antCount.
    const sectorSize = (Math.PI * 2) / totalPlayers;
    const baseAngle = playerIndex * sectorSize;
    const offset = antCount > 1 ? (i / (antCount - 1) - 0.5) * sectorSize * 0.8 : 0;
    const angle = baseAngle + offset;

    const x = Math.round(cx + Math.cos(angle) * radius);
    const y = Math.round(cy + Math.sin(angle) * radius);

    ants.push(makeAnt(playerIndex, i, clamp(x, 0, fieldW - 1), clamp(y, 0, fieldH - 1), i % 4 as 0 | 1 | 2 | 3));
  }
  return ants;
}

function spawnCorner(ctx: SpawnContext): SandboxAntConfig[] {
  const { playerIndex, fieldW, fieldH, antCount } = ctx;
  const corner = playerIndex % 4;
  const ants: SandboxAntConfig[] = [];

  // Углы: 0=NW, 1=NE, 2=SE, 3=SW
  for (let i = 0; i < antCount; i++) {
    const offset = 2 + i;
    let x: number, y: number, dir: 0 | 1 | 2 | 3;
    switch (corner) {
      case 0: x = offset; y = offset; dir = 2; break;
      case 1: x = fieldW - 1 - offset; y = offset; dir = 2; break;
      case 2: x = fieldW - 1 - offset; y = fieldH - 1 - offset; dir = 0; break;
      default: x = offset; y = fieldH - 1 - offset; dir = 0; break;
    }
    ants.push(makeAnt(playerIndex, i, clamp(x, 0, fieldW - 1), clamp(y, 0, fieldH - 1), dir));
  }
  return ants;
}

function spawnCluster(ctx: SpawnContext): SandboxAntConfig[] {
  const { playerIndex, totalPlayers, fieldW, fieldH, antCount, seed } = ctx;
  // У каждого игрока — своя зона по горизонтали
  const zoneX = ((playerIndex + 1) * fieldW) / (totalPlayers + 1);
  const zoneY = fieldH / 2;
  const radius = 4;
  const rng = mulberry32(seed + playerIndex * 1000);
  const ants: SandboxAntConfig[] = [];

  for (let i = 0; i < antCount; i++) {
    const x = Math.round(zoneX + (rng() - 0.5) * radius * 2);
    const y = Math.round(zoneY + (rng() - 0.5) * radius * 2);
    ants.push(makeAnt(
      playerIndex, i,
      clamp(x, 0, fieldW - 1),
      clamp(y, 0, fieldH - 1),
      Math.floor(rng() * 4) as 0 | 1 | 2 | 3,
    ));
  }
  return ants;
}

function spawnCenter(ctx: SpawnContext): SandboxAntConfig[] {
  const { playerIndex, fieldW, fieldH, antCount } = ctx;
  const cx = Math.floor(fieldW / 2);
  const cy = Math.floor(fieldH / 2);
  const ants: SandboxAntConfig[] = [];

  for (let i = 0; i < antCount; i++) {
    // Размещаем компактным кластером в центре, со смещением по игроку
    const offsetX = (playerIndex - 1) * 2 + (i % 3) - 1;
    const offsetY = Math.floor(i / 3) - 1;
    ants.push(makeAnt(
      playerIndex, i,
      clamp(cx + offsetX, 0, fieldW - 1),
      clamp(cy + offsetY, 0, fieldH - 1),
      i % 4 as 0 | 1 | 2 | 3,
    ));
  }
  return ants;
}

function spawnRandom(ctx: SpawnContext): SandboxAntConfig[] {
  const { playerIndex, fieldW, fieldH, antCount, seed } = ctx;
  const rng = mulberry32(seed + playerIndex * 7919);
  const ants: SandboxAntConfig[] = [];

  for (let i = 0; i < antCount; i++) {
    ants.push(makeAnt(
      playerIndex, i,
      Math.floor(rng() * fieldW),
      Math.floor(rng() * fieldH),
      Math.floor(rng() * 4) as 0 | 1 | 2 | 3,
    ));
  }
  return ants;
}

// ─── Хелперы ─────────────────────────────────────────────────────────────────

function makeAnt(playerIdx: number, seq: number, x: number, y: number, dir: 0 | 1 | 2 | 3): SandboxAntConfig {
  return { id: `p${playerIdx}_a${seq}`, x, y, dir, ruleOverride: null };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Подрезать координаты муравьёв если field изменился и они оказались вне границ.
 * Возвращает [новый список, сколько было обрезано].
 */
export function clampAntsToField(ants: SandboxAntConfig[], w: number, h: number): { ants: SandboxAntConfig[]; clamped: number } {
  let clamped = 0;
  const out = ants.map((a) => {
    const nx = clamp(a.x, 0, w - 1);
    const ny = clamp(a.y, 0, h - 1);
    if (nx !== a.x || ny !== a.y) clamped++;
    return { ...a, x: nx, y: ny };
  });
  return { ants: out, clamped };
}
