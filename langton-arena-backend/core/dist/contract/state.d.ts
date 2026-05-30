export type ScreenId = 'menu' | 'matchmaking' | 'lobby' | 'match' | 'result' | 'profile' | 'sandbox' | 'settings' | 'credits' | 'changelog';
export type LocaleCode = 'en' | 'ru' | 'uk' | 'de' | 'es' | 'fr' | 'zh' | 'ja' | 'ko' | 'pt';
export interface User {
    id: string;
    username: string;
    colorId: number;
    level: number;
    sr: number;
}
export type SpawnPattern = 'radial' | 'corner' | 'random' | 'cluster' | 'center' | 'manual';
export type Topology = 'torus' | 'wall' | 'bounce' | 'void';
/**
 * Stage 8 multi-grid: тип сетки клеток.
 *   - 'square'    {4,4}  — классическая квадратная сетка
 *   - 'triangle'  {3,6}  — треугольная (6 треугольников в каждой вершине)
 *   - 'hexagonal' {6,3}  — шестиугольная (3 шестиугольника в каждой вершине)
 */
export type GridType = 'square' | 'triangle' | 'hexagonal';
export type SandboxMode = 'edit' | 'run' | 'playback';
/** Один муравей в конфигурации (статика — до запуска или в Edit). */
export interface SandboxAntConfig {
    /** Уникальный ID. `p{i}_a{j}` для авто, `manual_{seq}` для placed. */
    id: string;
    x: number;
    y: number;
    dir: 0 | 1 | 2 | 3;
    /** Опциональное переопределение правила. null → берётся player.ruleId. */
    ruleOverride: string | null;
}
export interface SandboxPlayerConfig {
    id: string;
    name: string;
    color: string;
    ruleId: string;
    startHp: number;
    spawnPattern: SpawnPattern;
    /** Количество муравьёв при авто-spawn. Игнорируется если spawnPattern='manual'. */
    antCount: number;
    /** Финальный список муравьёв (после применения spawnPattern или ручной расстановки). */
    ants: SandboxAntConfig[];
}
export interface SandboxConfig {
    width: number;
    height: number;
    topology: Topology;
    /** Stage 8 multi-grid: тип сетки. Default 'square' для обратной совместимости. */
    gridType?: GridType;
    bgColor: string;
    showGrid: boolean;
    players: SandboxPlayerConfig[];
    hpEnabled: boolean;
    damageCapEnabled: boolean;
    collisionCooldownTicks: number;
    birthEnabled: boolean;
    birthMinNeighbors: number;
    birthCooldownTicks: number;
    maxAntsPerPlayer: number;
    hybridChance: number;
    wildBirthChance: number;
    /** Stage 2: снять лимит per-player; cap = width × height − 1. */
    unlimitedAnts: boolean;
    showGlow: boolean;
    showTrails: boolean;
    showHpDots: boolean;
    showDirectionArrows: boolean;
    /** Stage 2: показывать день/ночь состояние клетки (state-grid поверх territory). */
    showCellState: boolean;
    /** Stage 2: какой набор скинов использовать. 'shape' — procedural формы из палитры; 'kenney' — спрайты. */
    skinPack: 'shape' | 'kenney';
    /** Stage 4: heatmap overlay поверх канваса. */
    heatmapMode: 'off' | 'deaths' | 'captures' | 'contested';
    /** Stage 4: прозрачность heatmap overlay [0..1]. */
    heatmapOpacity: number;
    antScale: number;
    trailDecay: number;
    baseTps: number;
    speedMultiplier: number;
    seed: number;
    /** Mutation conditions. Включаются независимо. */
    mutation: MutationConfig;
    /** Win condition matchа. */
    winCondition: WinCondition;
    /** Per-preset toggle. По умолчанию false — backward compat. */
    reserveMode: boolean;
    /** Где можно выпускать муравьёв из мешка. */
    deployRule: 'anywhere' | 'own_territory' | 'near_alive';
    /** Радиус для near_alive (Чебышёв). */
    deployRadius: number;
}
export interface MutationConfig {
    /** Master toggle — если false, ни одно условие не проверяется. */
    enabled: boolean;
    haloEnabled: boolean;
    haloMinNeighbors: number;
    mirrorEnabled: boolean;
    mirrorRadius: number;
    pathEnabled: boolean;
    pathStraightTicks: number;
}
export type WinConditionKind = 'none' | 'time' | 'first_mutant' | 'n_mutants_total' | 'n_mutants_single' | 'survival';
export interface WinCondition {
    kind: WinConditionKind;
    /** Параметр N для time / n_mutants_total / n_mutants_single. */
    threshold: number;
}
export interface PlayerLiveStats {
    alive: number;
    born: number;
    lost: number;
    captures: number;
    kills: number;
    territoryPct: number;
    cellsOwned: number;
    mutants: number;
    mutantsAlive: number;
    /** Количество муравьёв в мешке этого игрока. */
    reserve: number;
}
export type LogEventType = 'capture' | 'clash' | 'death' | 'birth' | 'hybrid' | 'wild' | 'mutant' | 'reserve_in' | 'deploy';
export interface LogEvent {
    /** Глобальный счётчик для React key. */
    id: number;
    tick: number;
    type: LogEventType;
    x: number;
    y: number;
    /** Главный игрок события (capture — кто захватил; death — кто умер). */
    ownerIdx: number;
    /** Доп данные: clash — antCount; birth — isHybrid/isWild. */
    meta?: Record<string, number | string | boolean>;
}
export type HighlightType = 'longest_streak' | 'peak_territory' | 'biggest_fight' | 'first_death' | 'most_kills_clash';
export interface Highlight {
    id: string;
    type: HighlightType;
    /** Tick куда откатиться по клику. */
    tickStart: number;
    tickEnd?: number;
    title: string;
    description: string;
    ownerIdx?: number;
    /** Числовое значение для сортировки и сравнения. */
    value: number;
    /** Координаты на канвасе (опционально). */
    x?: number;
    y?: number;
}
export interface SandboxLiveStats {
    tick: number;
    perPlayer: Record<string, PlayerLiveStats>;
    territoryHistory: Array<{
        tick: number;
        byPlayer: Record<string, number>;
    }>;
    totals: {
        births: number;
        deaths: number;
        captures: number;
        clashes: number;
        hybrids: number;
        wilds: number;
        mutants: number;
    };
    /** Ring buffer событий, max 500. */
    events: LogEvent[];
    /** Highlights пересчитываются каждые 50 тиков. */
    highlights: Highlight[];
    /** Текущее состояние матча — обновляется в onTick. */
    match: MatchResult;
}
export interface MatchResult {
    finished: boolean;
    winnerId: string | null;
    winnerName: string | null;
    /** Человеко-читаемая причина: "5 mutants total", "last survivor" и т.д. */
    reason: string;
    finishedAtTick: number;
    /** Видно ли banner поверх канваса. Click Continue → bannerVisible=false. */
    bannerVisible: boolean;
    /** Stage 8 Day 11: per-player territory breakdown for final banner.
     *  Sorted by cells desc. cells = захваченные клетки, pct = cells/totalCells. */
    territory?: Array<{
        playerId: string;
        playerName: string;
        cells: number;
        pct: number;
    }>;
}
export interface SandboxRuntimeState {
    mode: SandboxMode;
    paused: boolean;
    activePlayerId: string | null;
    selectedAntId: string | null;
    liveStats: SandboxLiveStats;
    /** Stage 6: активен ли deploy-режим (курсор crosshair, hover-подсветка). */
    deployMode: boolean;
    /** Stage 7: ID воспроизводимого replay в режиме playback. */
    activeReplayId: string | null;
    /** Stage 7: имя для UI top-bar и оверлеев. */
    activeReplayName: string | null;
}
export interface UserPreset {
    id: string;
    name: string;
    createdAt: number;
    config: SandboxConfig;
}
export interface BuiltinPreset {
    id: string;
    name: string;
    category: 'builtin';
    description: string;
    tags: string[];
    author: string;
    config: SandboxConfig;
}
export interface AppState {
    currentScreen: ScreenId;
    user: User;
    locale: LocaleCode;
    themeId: string;
    sandbox: SandboxConfig;
    sandboxRuntime: SandboxRuntimeState;
    userPresets: UserPreset[];
}
//# sourceMappingURL=state.d.ts.map