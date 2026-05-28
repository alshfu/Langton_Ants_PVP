// core/src/lib/buildReplay.ts
//
// Stage 8 Day 12 — собираем Replay из finished match'а.
// Shared между server (отправляет в match_ended) и potentially client
// (если решит самостоятельно сохранить sandbox replay).
//
// Архитектурное решение: MVP без HTTP endpoint — payload летит inline
// в match_ended message (через ws.send). Альтернатива — отдельный endpoint
// /api/replays/:id.json. Отложили потому что добавит fastify dependency +
// authn/authz для cross-origin GET. Inline payload для PvP MVP (deployTimeline
// обычно < 50 entries) — ~2KB, не проблема.

import type { SandboxConfig } from '../contract/state.js';
import type { Replay, DeployAction } from '../contract/replay.js';
import { REPLAY_FORMAT_VERSION } from '../contract/replay.js';

export interface BuildReplayArgs {
  matchId: string;
  config: SandboxConfig;
  deployTimeline: readonly DeployAction[];
  finishedAtTick: number;
  /** Optional human-readable name. По умолчанию из matchId + timestamp. */
  name?: string;
  /** Default = now ms. */
  createdAt?: number;
  /** Source preset name если матч был построен из пресета. */
  presetName?: string;
}

export function buildReplayFromMatch(args: BuildReplayArgs): Replay {
  const createdAt = args.createdAt ?? Date.now();
  const name = args.name ?? `PvP · ${args.matchId.slice(0, 12)}`;
  return {
    version: REPLAY_FORMAT_VERSION,
    metadata: {
      id: `pvp-${args.matchId}`,
      name,
      createdAt,
      durationTicks: args.finishedAtTick,
      deployCount: args.deployTimeline.length,
      ...(args.presetName ? { presetName: args.presetName } : {}),
    },
    config: args.config,
    deployTimeline: [...args.deployTimeline], // защитная копия — immutable
  };
}
