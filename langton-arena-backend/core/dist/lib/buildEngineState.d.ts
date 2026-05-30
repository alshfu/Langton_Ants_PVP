import type { Ant, BirthConfig } from '../langton/engine.js';
import type { SandboxConfig } from '../contract/state.js';
/**
 * Build Ant[] array из SandboxConfig.players[].ants.
 * Использует ruleOverride если задан, иначе player.ruleId.
 */
export declare function buildAntsFromConfig(config: SandboxConfig): Ant[];
/**
 * Build BirthConfig из SandboxConfig.birth* и mutation полей.
 * Возвращает null если birth disabled.
 */
export declare function buildBirthConfig(c: SandboxConfig): BirthConfig | null;
//# sourceMappingURL=buildEngineState.d.ts.map