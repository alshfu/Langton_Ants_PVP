// core/src/contract/state.ts
//
// Контракт интерфейса — типы AppState.
// Соответствие: docs/interface-contract.md §3-4.
//
// Этот файл — ИСТОЧНИК ИСТИНЫ для типов, которые видит и фронт, и бэк.
// Любое изменение здесь требует:
//   1. Согласования с фронтенд-командой
//   2. Bump версии core
//   3. Обновления соответствующего раздела в interface-contract.md
//
// Структуры объёмные, и эта заглушка содержит ТОЛЬКО верхние уровни.
// Подробные вложенные типы (FieldState, MatchPlayer, и т.д.) — TODO.
// За полной спецификацией → docs/interface-contract.md.

export type Timestamp = number;       // unix milliseconds
export type TickCount = number;       // integer
export type Vector2 = { x: number; y: number };
export type Direction = 0 | 1 | 2 | 3;
export type LocaleCode = 'en' | 'ru' | 'uk' | 'de' | 'es' | 'fr' | 'zh' | 'ja' | 'ko' | 'pt';

// ─────────────────────────────────────────────────────────────────────────────
// Корневое состояние
// ─────────────────────────────────────────────────────────────────────────────

export type ScreenId =
  | 'menu' | 'matchmaking' | 'lobby' | 'tutorial' | 'match'
  | 'result' | 'reward' | 'profile' | 'sandbox' | 'settings'
  | 'credits' | 'changelog';

export interface AppState {
  // Meta
  version: string;
  buildHash: string;
  serverRegion: string;
  serverTime: Timestamp;
  clientTime: Timestamp;
  pingMs: number;

  // Connection
  connection: ConnectionState;

  // User
  user: User;

  // Service-wide
  status: ServiceStatus;
  locale: Locale;

  // Navigation
  currentScreen: ScreenId;
  previousScreen: ScreenId | null;

  // Screen states (всегда доступны, заполняются по мере необходимости)
  menu: MenuState;
  matchmaking: MatchmakingState;
  lobby: LobbyState;
  match: MatchState;
  result: ResultState;
  reward: RewardState;
  tutorial: TutorialState;
  profile: ProfileState;
  sandbox: SandboxState;
  settings: SettingsState;

  // Global UI
  toasts: Toast[];
  modal: Modal | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-states (TODO: дозаполнить из interface-contract.md §4)
// ─────────────────────────────────────────────────────────────────────────────

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  attemptsRemaining: number;
  lastError: string | null;
  serverUrl: string;
  protocol: 'ws' | 'wss';
  latencyMs: number;
  jitterMs: number;
}

export interface User {
  id: string;
  username: string;
  email: string | null;
  colorId: number;
  shapeId: number;
  level: number;
  xp: number;
  totalXp: number;
  sr: number;
  rank: RankTier;
  peakSr: number;
  matchesPlayed: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  isGuest: boolean;
  isPremium: boolean;
  createdAt: Timestamp;
}

export interface RankTier {
  id: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grandmaster';
  division: 'I' | 'II' | 'III' | 'IV' | null;
  label: string;
  color: string;
  iconUrl: string;
  minSr: number;
  maxSr: number;
}

export interface ServiceStatus {
  online: number;
  activeMatches: number;
  seasonId: string;
  seasonName: string;
  seasonEndsAt: Timestamp;
  daysRemaining: number;
  serverHealth: 'healthy' | 'degraded' | 'maintenance';
  announcement: string | null;
}

export interface Locale {
  current: LocaleCode;
  available: LocaleCode[];
  fallback: LocaleCode;
}

// Пустые заглушки — типы детализируются в interface-contract.md
export interface MenuState { /* TODO */ }
export interface MatchmakingState { /* TODO */ }
export interface LobbyState { /* TODO */ }
export interface MatchState { /* TODO */ }
export interface ResultState { /* TODO */ }
export interface RewardState { /* TODO */ }
export interface TutorialState { /* TODO */ }
export interface ProfileState { /* TODO */ }
export interface SandboxState { /* TODO */ }
export interface SettingsState { /* TODO */ }

// ─────────────────────────────────────────────────────────────────────────────
// Match — основная игровая структура (важнейшая для бэкенда)
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchPlayer {
  playerId: string;
  username: string;
  level: number;
  sr: number;
  rank: RankTier;
  colorId: number;
  shapeId: number;
  isYou: boolean;
  isHost: boolean;
  pingMs: number;
  cellsCount: number;
  cellsPercent: number;
  antsAlive: number;
  antsMax: number;
  antsBorn: number;
  antsLost: number;
  avgHp: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  damageTaken: number;
  isLeader: boolean;
  status: 'active' | 'eliminated' | 'disconnected' | 'spectating';
}

export interface LeaderboardRow {
  rank: number;
  player: MatchPlayer;
  isYou: boolean;
  isLeader: boolean;
  positionChangeFromLastTick: number;
  highlighted: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI-overlay
// ─────────────────────────────────────────────────────────────────────────────

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  durationMs: number;
  icon?: string;
  createdAt: Timestamp;
}

export interface Modal {
  id: string;
  type: 'confirm' | 'alert' | 'input' | 'custom';
  title: string;
  body: string;
  cancelable: boolean;
  buttons: Array<{
    label: string;
    variant: 'primary' | 'ghost' | 'danger';
    actionId: string;
    autoFocus?: boolean;
  }>;
}
