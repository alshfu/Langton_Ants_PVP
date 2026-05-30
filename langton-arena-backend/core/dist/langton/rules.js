// src/core/langton/rules.ts
//
// Направления и правила движения муравья.
/** 4 направления: N=0, E=1, S=2, W=3. [dx, dy] */
export const LA_DIRS = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
];
/** Стандартные правила. Ключ — id. Значение — строка из символов R/L/U. */
export const LA_RULES = {
    classic: 'RL',
    reverse: 'LR',
    spiral: 'LRR',
    flower: 'RLR',
    weave: 'LRLR',
    tornado: 'LRRLR',
    uturn: 'RR',
};
export function parseRule(s) {
    if (!s || s.length < 1 || s.length > 6)
        throw new Error(`Invalid rule length: "${s}"`);
    if (!/^[RLU]+$/.test(s))
        throw new Error(`Invalid rule chars: "${s}"`);
    return s;
}
//# sourceMappingURL=rules.js.map