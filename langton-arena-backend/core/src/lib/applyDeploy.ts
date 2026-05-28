// core/src/lib/applyDeploy.ts
//
// Stage 8 Day 9: shared apply-deploy helper для server (mvp-server Match) и
// client (MatchScreen onTick playback). Идентичная логика гарантирует
// bit-identical state между server и client'ами.
//
// NOTE: НЕ валидирует. Caller должен сначала canDeploy() если нужно.
// Server валидирует через Match.validateAndQueueDeploy; client доверяет
// server'у (apply из match_tick.deploys без локальной проверки).

import { LA_RULES } from '../langton/rules.js';
import type { SimState, Ant } from '../langton/engine.js';
import type { SandboxConfig } from '../contract/state.js';
import type { DeployAction } from '../contract/replay.js';

/**
 * Применить deploy action к sim — push нового Ant на field.
 * Возвращает true если apply прошёл (false = playerIdx некорректный).
 */
export function applyDeployAction(
  sim: SimState,
  action: DeployAction,
  config: SandboxConfig,
): boolean {
  const player = config.players[action.playerIdx];
  if (!player) return false;
  const ruleStr = LA_RULES[player.ruleId] ?? LA_RULES.classic!;
  const ant: Ant = {
    id: `${player.id}_deploy_${sim.tick}_${action.x}_${action.y}`,
    owner: action.playerIdx,
    x: action.x,
    y: action.y,
    dir: 0,
    rule: ruleStr,
    hp: player.startHp,
    maxHp: player.startHp,
    lastDamageTick: sim.tick - 9999,
    bornAt: sim.tick,
  };
  sim.ants.push(ant);
  return true;
}
