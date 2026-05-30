import type { SandboxConfig } from '../contract/state.js';
import type { Replay, DeployAction } from '../contract/replay.js';
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
export declare function buildReplayFromMatch(args: BuildReplayArgs): Replay;
//# sourceMappingURL=buildReplay.d.ts.map