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

// === Deploy validation (shared client + server) =============================
export {
  canDeploy,
} from './lib/deployValidation';
export type {
  DeployRule,
  DeployConfig,
  DeployValidation,
} from './lib/deployValidation';
