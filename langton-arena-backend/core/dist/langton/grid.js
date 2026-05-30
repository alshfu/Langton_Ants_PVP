// core/src/langton/grid.ts
//
// Grid abstraction для multi-grid Langton's ant.
// Поддержка трёх систем: квадратная {4,4}, треугольная {3,6}, гексагональная {6,3}.
//
// Schläfli symbols:
//   square     {4, 4} — 4 квадрата в каждой вершине, 4 соседа на клетку
//   triangle   {3, 6} — 6 треугольников в каждой вершине, 3 соседа на клетку
//   hexagonal  {6, 3} — 3 шестиугольника в каждой вершине, 6 соседей на клетку
//
// Хранение всё ещё 2D array (Uint8Array indexed y*w+x). Различие — в neighbor
// lookup (зависит от parity для tri/hex) и числе directions у ant'а.
// ─── Square {4,4} ───────────────────────────────────────────────────────────
// N=0 (up), E=1 (right), S=2 (down), W=3 (left). R/L = ±90°.
const SQUARE_NEIGHBORS = [
    [0, -1], [1, 0], [0, 1], [-1, 0],
];
// ─── Triangle {3,6} ─────────────────────────────────────────────────────────
// Каждая клетка — треугольник. Чередование up/down по чётности (x+y).
// Up-triangle (x+y чётно): соседи слева, справа, снизу (через нижнее ребро).
// Down-triangle (x+y нечётно): соседи слева, справа, сверху.
// R/L = ±120° (один шаг по соседям).
const TRIANGLE_NEIGHBORS_UP = [
    [-1, 0], // 0: left
    [1, 0], // 1: right
    [0, 1], // 2: down (across base edge of up-triangle)
];
const TRIANGLE_NEIGHBORS_DOWN = [
    [-1, 0], // 0: left
    [1, 0], // 1: right
    [0, -1], // 2: up (across top edge of down-triangle)
];
// ─── Hexagonal {6,3} ────────────────────────────────────────────────────────
// Pointy-top hex с "even-r offset" coordinates. Even rows (y чётно) сдвинуты
// влево относительно odd rows. 6 соседей на клетку. R/L = ±60°.
//
// Direction ordering (clockwise начиная с N):
//   0=N, 1=NE, 2=SE, 3=S, 4=SW, 5=NW
const HEX_NEIGHBORS_EVEN_ROW = [
    [0, -1], // 0: N
    [1, -1], // 1: NE (offset row above-right)
    [1, 0], // 2: SE
    [0, 1], // 3: S
    [-1, 0], // 4: SW
    [-1, -1], // 5: NW
];
const HEX_NEIGHBORS_ODD_ROW = [
    [0, -1], // 0: N
    [1, 0], // 1: NE
    [1, 1], // 2: SE
    [0, 1], // 3: S
    [-1, 1], // 4: SW
    [-1, 0], // 5: NW
];
// ─── Public API ─────────────────────────────────────────────────────────────
/**
 * Get neighbor offsets для клетки (x, y) в указанном grid type.
 * Length массива = numDirs (число directions у ant'а).
 *
 * Для square — фиксированные 4 соседа.
 * Для triangle — зависит от parity (x+y): up-triangle vs down-triangle.
 * Для hexagonal — зависит от parity y: even row vs odd row offset.
 */
export function getNeighbors(x, y, gridType) {
    switch (gridType) {
        case 'square':
            return SQUARE_NEIGHBORS;
        case 'triangle':
            return ((x + y) & 1) === 0 ? TRIANGLE_NEIGHBORS_UP : TRIANGLE_NEIGHBORS_DOWN;
        case 'hexagonal':
            return (y & 1) === 0 ? HEX_NEIGHBORS_EVEN_ROW : HEX_NEIGHBORS_ODD_ROW;
    }
}
/** Number of directions ant can face on given grid. */
export function getNumDirs(gridType) {
    switch (gridType) {
        case 'square': return 4;
        case 'triangle': return 3;
        case 'hexagonal': return 6;
    }
}
/**
 * Apply rule character к direction. R/L — ±1 шаг по соседям (±90° на square,
 * ±120° на triangle, ±60° на hex). U — поворот на ~180° (numDirs/2 шагов).
 */
export function applyRuleChar(dir, ch, numDirs) {
    switch (ch) {
        case 'R': return (dir + 1) % numDirs;
        case 'L': return (dir - 1 + numDirs) % numDirs;
        case 'U': return (dir + Math.floor(numDirs / 2)) % numDirs;
        default: return dir; // unknown char — no-op (safety)
    }
}
//# sourceMappingURL=grid.js.map