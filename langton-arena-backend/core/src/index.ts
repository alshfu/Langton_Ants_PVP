// core/src/index.ts
//
// @langton/core — shared game engine + types.
// Используется frontend (langton-arena-web) и backend services (Stage 8+).
//
// Stage 8 Day 1: engine физически переехал сюда из frontend.
// Frontend импортирует через workspace dependency "@langton/core".
//
// Дополнительные backend-only типы (MatchState, ServiceStatus, actions, events,
// protocol, shared/constants) пока НЕ экспортируются — они для будущих сервисов
// и не используются frontend'ом. Доступны через прямой путь:
//   import { ... } from '@langton/core/contract/actions'
// (или через add export здесь когда понадобятся в mvp-server).

// === Игровой движок (canonical source) ======================================
export {
  makeLangtonState,
  stepLangton,
} from './langton/engine';
export type {
  SimState,
  Ant,
  BirthConfig,
  StepEvents,
  MakeStateConfig,
  Topology,
} from './langton/engine';

export {
  LA_RULES,
  LA_DIRS,
  parseRule,
} from './langton/rules';

export {
  getNeighbors,
  getNumDirs,
  applyRuleChar,
} from './langton/grid';
export type { GridType as EngineGridType } from './langton/grid';

export {
  mulberry32,
} from './langton/prng';
export type { PRNG } from './langton/prng';

// === Контракт состояния (sandbox + replay) ==================================
export type {
  AppState,
  ScreenId,
  LocaleCode,
  User,
  SpawnPattern,
  Topology as ContractTopology,  // alias чтобы не дублироваться с engine.Topology
  GridType,                       // Stage 8 multi-grid
  SandboxMode,
  SandboxAntConfig,
  SandboxPlayerConfig,
  SandboxConfig,
  SandboxRuntimeState,
  BuiltinPreset,
  UserPreset,
  PlayerLiveStats,
  SandboxLiveStats,
  LogEvent,
  LogEventType,
  Highlight,
  HighlightType,
  WinCondition,
  WinConditionKind,
  MatchResult,
  MutationConfig,
} from './contract/state';

export type {
  Replay,
  ReplayMetadata,
  DeployAction,
} from './contract/replay';
export {
  REPLAY_FORMAT_VERSION,
} from './contract/replay';

// === Build engine state (shared client + server) ============================
export {
  buildAntsFromConfig,
  buildBirthConfig,
} from './lib/buildEngineState';

// === Apply deploy action (shared client + server) ===========================
export {
  applyDeployAction,
} from './lib/applyDeploy';

// === Compute territory + winner (Day 11) ====================================
export {
  computeTerritory,
  computeWinnerByTerritory,
} from './lib/computeTerritory';
export type {
  TerritoryEntry,
  PlayerRef,
} from './lib/computeTerritory';

// === hold_majority win condition (Day 35) ===================================
export { holdMajorityTick } from './lib/holdMajority';
export type { HoldCheckResult } from './lib/holdMajority';

// === Build replay from match (Day 12) =======================================
export {
  buildReplayFromMatch,
} from './lib/buildReplay';
export type {
  BuildReplayArgs,
} from './lib/buildReplay';

// === Rate limiting (Day 14) =================================================
export {
  SlidingWindowLimiter,
  RATE_LIMITS,
} from './lib/rateLimit';
export type {
  RateLimitConfig,
} from './lib/rateLimit';

// === Deploy validation (shared client + server) =============================
export {
  canDeploy,
} from './lib/deployValidation';
export type {
  DeployRule,
  DeployConfig,
  DeployValidation,
} from './lib/deployValidation';

// === Stage 8 WebSocket protocol (shared client + server) ====================
// NOTE: DeployAction уже экспортируется из './contract/replay' выше,
// поэтому из './protocol/stage8' экспортируем под алиасом DeployActionWS.
// На практике это тот же type — обе ветки используют одинаковую shape.
export {
  ERROR_CODES,
  isClientMessage,
} from './protocol/stage8';
export type {
  PlayerInfo,
  ClientMessage,
  ClientMessageType,
  ServerMessage,
  ServerMessageType,
  ErrorCode,
} from './protocol/stage8';
