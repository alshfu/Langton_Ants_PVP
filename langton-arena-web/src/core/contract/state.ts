// src/core/contract/state.ts
//
// Типы AppState для web-клиента. Sandbox v2 — Stage 1.
// Полная версия контракта — в langton-arena-backend/docs/interface-contract.md.

export type ScreenId =
  | 'menu' | 'matchmaking' | 'lobby' | 'match' | 'result'
  | 'profile' | 'sandbox' | 'settings' | 'credits' | 'changelog';

export type LocaleCode = 'en' | 'ru' | 'uk' | 'de' | 'es' | 'fr' | 'zh' | 'ja' | 'ko' | 'pt';

export interface User {
  id: string;
  username: string;
  colorId: number;
  level: number;
  sr: number;
}

// ─── Sandbox v2 ──────────────────────────────────────────────────────────────

export type SpawnPattern = 'radial' | 'corner' | 'random' | 'cluster' | 'center' | 'manual';
export type Topology = 'torus' | 'wall' | 'bounce' | 'void';
export type SandboxMode = 'edit' | 'run';

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
  // Field
  width: number;
  height: number;
  topology: Topology;
  bgColor: string;
  showGrid: boolean;

  // Players
  players: SandboxPlayerConfig[];

  // Combat
  hpEnabled: boolean;
  damageCapEnabled: boolean;
  collisionCooldownTicks: number;

  // Birth
  birthEnabled: boolean;
  birthMinNeighbors: number;
  birthCooldownTicks: number;
  maxAntsPerPlayer: number;
  hybridChance: number;
  wildBirthChance: number;
  /** Stage 2: снять лимит per-player; cap = width × height − 1. */
  unlimitedAnts: boolean;

  // Visual
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

  // Control
  baseTps: number;
  speedMultiplier: number;
  seed: number;
}

// ─── Stage 2: Live Stats ─────────────────────────────────────────────────────

export interface PlayerLiveStats {
  alive: number;
  born: number;
  lost: number;
  captures: number;
  kills: number;
  territoryPct: number;
  cellsOwned: number;
}

// ─── Stage 4: Analytics ──────────────────────────────────────────────────────

export type LogEventType = 'capture' | 'clash' | 'death' | 'birth' | 'hybrid' | 'wild';

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

export type HighlightType =
  | 'longest_streak'
  | 'peak_territory'
  | 'biggest_fight'
  | 'first_death'
  | 'most_kills_clash';

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
  };
  // ── Stage 4 ────────────────────────────────────────────
  /** Ring buffer событий, max 500. */
  events: LogEvent[];
  /** Highlights пересчитываются каждые 50 тиков. */
  highlights: Highlight[];
}

export interface SandboxRuntimeState {
  mode: SandboxMode;
  paused: boolean;
  activePlayerId: string | null;
  selectedAntId: string | null;
  liveStats: SandboxLiveStats;
}

// ─── User preset (в localStorage) ────────────────────────────────────────────

export interface UserPreset {
  id: string;
  name: string;
  createdAt: number;
  config: SandboxConfig;
}

// ─── Built-in preset (из public/presets/*.json) ──────────────────────────────

export interface BuiltinPreset {
  id: string;
  name: string;
  category: 'builtin';
  description: string;
  tags: string[];
  author: string;
  config: SandboxConfig;
}

// ─── Корневое состояние ──────────────────────────────────────────────────────

export interface AppState {
  currentScreen: ScreenId;
  user: User;
  locale: LocaleCode;
  themeId: string;
  sandbox: SandboxConfig;
  sandboxRuntime: SandboxRuntimeState;
  userPresets: UserPreset[];
}
