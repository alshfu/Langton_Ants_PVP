export type GridType = 'square' | 'triangle' | 'hexagonal';
/** Offsets для соседних клеток. Length определяет numDirs ant'а. */
type Offsets = ReadonlyArray<readonly [number, number]>;
/**
 * Get neighbor offsets для клетки (x, y) в указанном grid type.
 * Length массива = numDirs (число directions у ant'а).
 *
 * Для square — фиксированные 4 соседа.
 * Для triangle — зависит от parity (x+y): up-triangle vs down-triangle.
 * Для hexagonal — зависит от parity y: even row vs odd row offset.
 */
export declare function getNeighbors(x: number, y: number, gridType: GridType): Offsets;
/** Number of directions ant can face on given grid. */
export declare function getNumDirs(gridType: GridType): number;
/**
 * Apply rule character к direction. R/L — ±1 шаг по соседям (±90° на square,
 * ±120° на triangle, ±60° на hex). U — поворот на ~180° (numDirs/2 шагов).
 */
export declare function applyRuleChar(dir: number, ch: string, numDirs: number): number;
export {};
//# sourceMappingURL=grid.d.ts.map