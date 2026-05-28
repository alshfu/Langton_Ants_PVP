// core/src/lib/buildEngineState.ts
//
// Stage 8 Day 8: shared helpers for building engine state from SandboxConfig.
// Используется sandbox (frontend useMemo), mvp-server (Match ctor), и
// frontend PvP match (MatchScreen).

import { LA_RULES } from '../langton/rules.js';
import type { Ant, BirthConfig } from '../langton/engine.js';
import type { SandboxConfig } from '../contract/state.js';

/**
 * Build Ant[] array из SandboxConfig.players[].ants.
 * Использует ruleOverride если задан, иначе player.ruleId.
 */
export function buildAntsFromConfig(config: SandboxConfig): Ant[] {
  const list: Ant[] = [];
  config.players.forEach((p, pi) => {
    const playerRule = LA_RULES[p.ruleId] ?? LA_RULES.classic!;
    p.ants.forEach((a) => {
      const rule = a.ruleOverride ? (LA_RULES[a.ruleOverride] ?? playerRule) : playerRule;
      list.push({
        id: a.id,
        owner: pi,
        x: a.x,
        y: a.y,
        dir: a.dir,
        rule,
        hp: p.startHp,
        maxHp: p.startHp,
        lastDamageTick: -9999,
        bornAt: 0,
      });
    });
  });
  return list;
}

/**
 * Build BirthConfig из SandboxConfig.birth* и mutation полей.
 * Возвращает null если birth disabled.
 */
export function buildBirthConfig(c: SandboxConfig): BirthConfig | null {
  if (!c.birthEnabled) return null;
  return {
    enabled: true,
    minNeighbors:     c.birthMinNeighbors,
    cooldownTicks:    c.birthCooldownTicks,
    maxAntsPerPlayer: c.maxAntsPerPlayer,
    hybridChance:     c.hybridChance,
    wildChance:       c.wildBirthChance,
    unlimited:        c.unlimitedAnts,
    mutation: c.mutation.enabled ? {
      haloEnabled:       c.mutation.haloEnabled,
      haloMinNeighbors:  c.mutation.haloMinNeighbors,
      mirrorEnabled:     c.mutation.mirrorEnabled,
      mirrorRadius:      c.mutation.mirrorRadius,
      pathEnabled:       c.mutation.pathEnabled,
      pathStraightTicks: c.mutation.pathStraightTicks,
    } : undefined,
    reserveMode: c.reserveMode,
    // onReserve — Stage 8 Day 8: для PvP пока без reserve mode
  };
}
