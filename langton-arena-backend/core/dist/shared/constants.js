// core/src/shared/constants.ts
//
// Глобальные константы игры. Используются и фронтом, и бэком.
// Изменения здесь = балансные изменения, требуют QA.
/** 10 цветов для слотов в матче. Индекс = colorId. */
export const PLAYER_PALETTE = [
    { id: 0, hex: '#FF5470', name: 'Crimson', shape: 'circle' },
    { id: 1, hex: '#4DA8FF', name: 'Azure', shape: 'triangle' },
    { id: 2, hex: '#39D98A', name: 'Mint', shape: 'diamond' },
    { id: 3, hex: '#FFD60A', name: 'Amber', shape: 'hexagon' },
    { id: 4, hex: '#C77DFF', name: 'Violet', shape: 'square' },
    { id: 5, hex: '#FF8A3D', name: 'Tangerine', shape: 'star' },
    { id: 6, hex: '#00E5D1', name: 'Teal', shape: 'cross' },
    { id: 7, hex: '#FF4D9E', name: 'Magenta', shape: 'pentagon' },
    { id: 8, hex: '#FFCC00', name: 'Sunflower', shape: 'octagon' },
    { id: 9, hex: '#7DD3FC', name: 'Sky', shape: 'ring' },
];
/** Полный реестр правил. Простые в core/langton/rules.ts. Здесь — расширенные метаданные для UI. */
export const RULES_REGISTRY = [
    { id: 'classic', label: 'Classic', pattern: 'RL', color: '#4DA8FF',
        description: 'Highway after ~10k ticks', cost: 2, isCustom: false },
    { id: 'reverse', label: 'Reverse', pattern: 'LR', color: '#FF8A3D',
        description: 'Inverts neighbour state', cost: 2, isCustom: false },
    { id: 'spiral', label: 'Spiral', pattern: 'LRR', color: '#C77DFF',
        description: 'Tight expanding spirals', cost: 2, isCustom: false },
    { id: 'flower', label: 'Flower', pattern: 'RLR', color: '#39D98A',
        description: 'Symmetric petal pattern', cost: 3, isCustom: false },
    { id: 'weave', label: 'Weave', pattern: 'LRLR', color: '#FF4D9E',
        description: 'Woven texture', cost: 3, isCustom: false },
    { id: 'tornado', label: 'Tornado', pattern: 'LRRLR', color: '#FFD60A',
        description: 'Chaotic storms', cost: 4, isCustom: false },
    { id: 'uturn', label: 'U-turn', pattern: 'RR', color: '#7DD3FC',
        description: 'Patrols small areas', cost: 1, isCustom: false },
];
// ─────────────────────────────────────────────────────────────────────────────
// Ранги
// ─────────────────────────────────────────────────────────────────────────────
export const RANK_TIERS = [
    { id: 'bronze', division: 'IV', label: 'Bronze IV', color: '#CD7F32', iconUrl: 'rank/bronze.svg', minSr: 0, maxSr: 500 },
    { id: 'bronze', division: 'III', label: 'Bronze III', color: '#CD7F32', iconUrl: 'rank/bronze.svg', minSr: 500, maxSr: 700 },
    { id: 'bronze', division: 'II', label: 'Bronze II', color: '#CD7F32', iconUrl: 'rank/bronze.svg', minSr: 700, maxSr: 850 },
    { id: 'bronze', division: 'I', label: 'Bronze I', color: '#CD7F32', iconUrl: 'rank/bronze.svg', minSr: 850, maxSr: 1000 },
    { id: 'silver', division: 'IV', label: 'Silver IV', color: '#C0C0C0', iconUrl: 'rank/silver.svg', minSr: 1000, maxSr: 1150 },
    { id: 'silver', division: 'III', label: 'Silver III', color: '#C0C0C0', iconUrl: 'rank/silver.svg', minSr: 1150, maxSr: 1300 },
    { id: 'silver', division: 'II', label: 'Silver II', color: '#C0C0C0', iconUrl: 'rank/silver.svg', minSr: 1300, maxSr: 1450 },
    { id: 'silver', division: 'I', label: 'Silver I', color: '#C0C0C0', iconUrl: 'rank/silver.svg', minSr: 1450, maxSr: 1600 },
    { id: 'gold', division: 'IV', label: 'Gold IV', color: '#FFD700', iconUrl: 'rank/gold.svg', minSr: 1600, maxSr: 1750 },
    { id: 'gold', division: 'III', label: 'Gold III', color: '#FFD700', iconUrl: 'rank/gold.svg', minSr: 1750, maxSr: 1900 },
    { id: 'gold', division: 'II', label: 'Gold II', color: '#FFD700', iconUrl: 'rank/gold.svg', minSr: 1900, maxSr: 2050 },
    { id: 'gold', division: 'I', label: 'Gold I', color: '#FFD700', iconUrl: 'rank/gold.svg', minSr: 2050, maxSr: 2200 },
    { id: 'platinum', division: 'IV', label: 'Platinum IV', color: '#4DA8FF', iconUrl: 'rank/platinum.svg', minSr: 2200, maxSr: 2350 },
    { id: 'platinum', division: 'III', label: 'Platinum III', color: '#4DA8FF', iconUrl: 'rank/platinum.svg', minSr: 2350, maxSr: 2500 },
    { id: 'platinum', division: 'II', label: 'Platinum II', color: '#4DA8FF', iconUrl: 'rank/platinum.svg', minSr: 2500, maxSr: 2650 },
    { id: 'platinum', division: 'I', label: 'Platinum I', color: '#4DA8FF', iconUrl: 'rank/platinum.svg', minSr: 2650, maxSr: 2800 },
    { id: 'diamond', division: 'IV', label: 'Diamond IV', color: '#39D98A', iconUrl: 'rank/diamond.svg', minSr: 2800, maxSr: 2950 },
    { id: 'diamond', division: 'III', label: 'Diamond III', color: '#39D98A', iconUrl: 'rank/diamond.svg', minSr: 2950, maxSr: 3100 },
    { id: 'diamond', division: 'II', label: 'Diamond II', color: '#39D98A', iconUrl: 'rank/diamond.svg', minSr: 3100, maxSr: 3250 },
    { id: 'diamond', division: 'I', label: 'Diamond I', color: '#39D98A', iconUrl: 'rank/diamond.svg', minSr: 3250, maxSr: 3400 },
    { id: 'master', division: null, label: 'Master', color: '#C77DFF', iconUrl: 'rank/master.svg', minSr: 3400, maxSr: 3700 },
    { id: 'grandmaster', division: null, label: 'Grandmaster', color: '#FF5470', iconUrl: 'rank/grandmaster.svg', minSr: 3700, maxSr: Number.POSITIVE_INFINITY },
];
/**
 * Найти тир по SR.
 * Граничное условие: minSr <= sr < maxSr (для последнего тира — sr >= minSr).
 */
export function rankFromSr(sr) {
    for (const tier of RANK_TIERS) {
        if (sr >= tier.minSr && sr < tier.maxSr)
            return tier;
    }
    // Свыше максимума — возвращаем последний тир (grandmaster)
    return RANK_TIERS[RANK_TIERS.length - 1];
}
// ─────────────────────────────────────────────────────────────────────────────
// Игровые лимиты
// ─────────────────────────────────────────────────────────────────────────────
export const GAME_LIMITS = {
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 10,
    MATCH_DURATION_TICKS: 3000, // 5 минут × 10 TPS
    DEFAULT_TPS: 10,
    DEFAULT_FIELD_W: 100,
    DEFAULT_FIELD_H: 100,
    ANTS_PER_PLAYER: 5,
    DEFAULT_HP: 3,
    COLLISION_COOLDOWN_TICKS: 5,
    USERNAME_MIN: 3,
    USERNAME_MAX: 20,
    CHAT_MAX_LEN: 200,
    RESERVE_MAX: 5,
    CHARGES_MAX: 5,
};
//# sourceMappingURL=constants.js.map