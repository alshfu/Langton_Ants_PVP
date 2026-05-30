import type { SimState } from '../langton/engine.js';
import type { SandboxConfig } from '../contract/state.js';
import type { DeployAction } from '../contract/replay.js';
/**
 * Применить deploy action к sim — push нового Ant на field.
 * Возвращает true если apply прошёл (false = playerIdx некорректный).
 */
export declare function applyDeployAction(sim: SimState, action: DeployAction, config: SandboxConfig): boolean;
//# sourceMappingURL=applyDeploy.d.ts.map