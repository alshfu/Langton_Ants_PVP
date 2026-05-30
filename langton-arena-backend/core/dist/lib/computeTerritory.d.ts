import type { SimState } from '../langton/engine.js';
export interface TerritoryEntry {
    playerId: string;
    playerName: string;
    cells: number;
    pct: number;
}
export interface PlayerRef {
    id: string;
    name: string;
}
/**
 * Подсчёт клеток по владельцу. Возвращает entries в порядке players[] —
 * caller sortирует если нужно.
 */
export declare function computeTerritory(sim: Pick<SimState, 'owner'>, players: readonly PlayerRef[]): TerritoryEntry[];
/**
 * Определить победителя по территории. При ничьей (равные cells) возвращает
 * winnerIdx = null. Возвращает territory отсортированный desc by cells.
 */
export declare function computeWinnerByTerritory(sim: Pick<SimState, 'owner'>, players: readonly PlayerRef[]): {
    winnerIdx: number | null;
    territory: TerritoryEntry[];
};
//# sourceMappingURL=computeTerritory.d.ts.map