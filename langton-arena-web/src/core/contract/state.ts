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

  // Visual
  showGlow: boolean;
  showTrails: boolean;
  showHpDots: boolean;
  showDirectionArrows: boolean;
  antScale: number;
  trailDecay: number;

  // Control
  baseTps: number;
  speedMultiplier: number;
  seed: number;
}

export interface SandboxRuntimeState {
  mode: SandboxMode;
  paused: boolean;
  activePlayerId: string | null;
  selectedAntId: string | null;
  liveStats: {
    tick: number;
    aliveByPlayer: Record<string, number>;
    deathsByPlayer: Record<string, number>;
    birthsByPlayer: Record<string, number>;
  };
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
