import { type PRNG } from './prng';
import { type GridType } from './grid';
/** Stage 7.6: поведение муравья при попытке пересечь край поля. */
export type Topology = 'torus' | 'wall' | 'bounce' | 'void';
/** Re-export GridType — engine использует, контракт ссылается. */
export type { GridType } from './grid';
export interface Ant {
    id: string;
    owner: number;
    x: number;
    y: number;
    /**
     * Направление муравья. На square — 0..3 (NESW), на triangle — 0..2,
     * на hexagonal — 0..5. Maximum = numDirs(gridType) - 1.
     */
    dir: number;
    rule: string;
    hp: number;
    maxHp: number;
    lastDamageTick: number;
    bornAt: number;
    dead?: boolean;
    isHybrid?: boolean;
    isWild?: boolean;
    /** Stage 5: мутант — родился при выполнении одного из mutation conditions. */
    isMutant?: boolean;
    /** Stage 5: какое условие сработало. Приоритет halo > mirror > path. */
    mutantCause?: 'halo' | 'mirror' | 'path';
    /** Stage 5: счётчик тиков подряд без damage (для условия Path). */
    straightTicks?: number;
}
export interface BirthConfig {
    enabled: boolean;
    minNeighbors: number;
    cooldownTicks: number;
    maxAntsPerPlayer: number;
    hybridChance: number;
    wildChance: number;
    /** Stage 2: если true — игнорируется maxAntsPerPlayer; cap = w*h - 1. */
    unlimited?: boolean;
    /** Stage 5: Mutation conditions. Если объект не передан — мутации выключены. */
    mutation?: {
        haloEnabled: boolean;
        haloMinNeighbors: number;
        mirrorEnabled: boolean;
        mirrorRadius: number;
        pathEnabled: boolean;
        pathStraightTicks: number;
    };
    /** Stage 6: если true — рождения идут в мешок через onReserve вместо ants.push. */
    reserveMode?: boolean;
    /** Stage 6: callback вызывается вместо ants.push когда reserveMode=true. */
    onReserve?: (newAnt: Ant) => void;
}
export interface SimState {
    w: number;
    h: number;
    tick: number;
    ants: Ant[];
    /** Owner-grid (1..N для игроков, 0 нейтральный, 255 wild). */
    owner: Uint8Array;
    /** State-grid для физики Лэнгтона (0..len-1 по правилу). */
    state: Uint8Array;
    collisionCooldownTicks: number;
    /** Stage 3: если false — HP не вычитается, муравьи не умирают (обзорный режим). */
    hpEnabled: boolean;
    /** Stage 3: если false — урон накопительный (каждый враг = −1 HP). */
    damageCapEnabled: boolean;
    birthConfig: BirthConfig | null;
    lastBirthTickByOwner: Record<number, number>;
    rng: PRNG;
    seed: number;
    /** Stage 7.6: поведение на краях. По умолчанию 'torus' (wrap-around). */
    topology: Topology;
    /**
     * Stage 8 multi-grid: тип сетки.
     *   - 'square'    {4,4} — 4 соседа, ant.dir ∈ 0..3, R/L = ±90°
     *   - 'triangle'  {3,6} — 3 соседа, ant.dir ∈ 0..2, R/L = ±120°
     *   - 'hexagonal' {6,3} — 6 соседей, ant.dir ∈ 0..5, R/L = ±60°
     * Default 'square' для обратной совместимости.
     */
    gridType: GridType;
}
export interface StepEvents {
    captures: Array<{
        x: number;
        y: number;
        owner: number;
    }>;
    collisions: Array<{
        x: number;
        y: number;
        antIds: string[];
    }>;
    damage: Array<{
        id: string;
        owner: number;
        hp: number;
        enemies: number;
    }>;
    deaths: Array<{
        id: string;
        owner: number;
        x: number;
        y: number;
    }>;
    births: Array<{
        id: string;
        owner: number;
        x: number;
        y: number;
        isHybrid: boolean;
        isWild: boolean;
        isMutant?: boolean;
        mutantCause?: 'halo' | 'mirror' | 'path';
        /** Stage 6: если true — муравей не появился на поле, ушёл в мешок. */
        reserved?: boolean;
    }>;
}
export interface MakeStateConfig {
    w: number;
    h: number;
    ants: Array<Omit<Ant, 'maxHp' | 'lastDamageTick' | 'bornAt'> & {
        maxHp?: number;
    }>;
    seed?: number;
    collisionCooldownTicks?: number;
    /** Stage 3: false → муравьи неуязвимы (обзорный режим). По умолчанию true. */
    hpEnabled?: boolean;
    /** Stage 3: false → урон накопительный, каждый враг −1 HP. По умолчанию true. */
    damageCapEnabled?: boolean;
    birthConfig?: BirthConfig | null;
    /** Stage 7.6: топология поля. По умолчанию 'torus'. */
    topology?: Topology;
    /** Stage 8 multi-grid: тип сетки. По умолчанию 'square'. */
    gridType?: GridType;
}
export declare function makeLangtonState(config: MakeStateConfig): SimState;
export declare function stepLangton(sim: SimState): StepEvents;
//# sourceMappingURL=engine.d.ts.map