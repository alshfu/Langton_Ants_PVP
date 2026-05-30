import type { SimState } from '../langton/engine.js';
export type DeployRule = 'anywhere' | 'own_territory' | 'near_alive';
export interface DeployConfig {
    deployRule: DeployRule;
    deployRadius: number;
}
export type DeployValidation = {
    ok: true;
} | {
    ok: false;
    reason: string;
};
/**
 * Проверка возможности выпустить муравья в (x, y).
 * Учитывает:
 *  - клетка свободна (нет живого муравья там)
 *  - правило расположения (anywhere / own_territory / near_alive)
 *
 * NOTE: не проверяет наличие в мешке — это делает caller (SandboxScreen).
 */
export declare function canDeploy(x: number, y: number, playerIdx: number, sim: SimState, cfg: DeployConfig): DeployValidation;
//# sourceMappingURL=deployValidation.d.ts.map