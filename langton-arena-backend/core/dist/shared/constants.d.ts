import type { RankTier } from '../contract/state';
export interface PlayerColor {
    id: number;
    hex: string;
    name: string;
    shape: 'circle' | 'triangle' | 'diamond' | 'hexagon' | 'square' | 'star' | 'cross' | 'pentagon' | 'octagon' | 'ring';
}
/** 10 цветов для слотов в матче. Индекс = colorId. */
export declare const PLAYER_PALETTE: ReadonlyArray<PlayerColor>;
export interface RuleMeta {
    id: string;
    label: string;
    pattern: string;
    color: string;
    description: string;
    cost: number;
    isCustom: boolean;
}
/** Полный реестр правил. Простые в core/langton/rules.ts. Здесь — расширенные метаданные для UI. */
export declare const RULES_REGISTRY: ReadonlyArray<RuleMeta>;
export declare const RANK_TIERS: ReadonlyArray<RankTier>;
/**
 * Найти тир по SR.
 * Граничное условие: minSr <= sr < maxSr (для последнего тира — sr >= minSr).
 */
export declare function rankFromSr(sr: number): RankTier;
export declare const GAME_LIMITS: {
    readonly MIN_PLAYERS: 2;
    readonly MAX_PLAYERS: 10;
    readonly MATCH_DURATION_TICKS: 3000;
    readonly DEFAULT_TPS: 10;
    readonly DEFAULT_FIELD_W: 100;
    readonly DEFAULT_FIELD_H: 100;
    readonly ANTS_PER_PLAYER: 5;
    readonly DEFAULT_HP: 3;
    readonly COLLISION_COOLDOWN_TICKS: 5;
    readonly USERNAME_MIN: 3;
    readonly USERNAME_MAX: 20;
    readonly CHAT_MAX_LEN: 200;
    readonly RESERVE_MAX: 5;
    readonly CHARGES_MAX: 5;
};
//# sourceMappingURL=constants.d.ts.map