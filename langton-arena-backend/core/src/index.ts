// core/src/index.ts
//
// Главная точка входа пакета @langton/core.
// Все, что нужно экспортировать наружу — реэкспорт из модулей.
//
// Импорт у потребителя:
//   import { stepLangton, MatchState } from '@langton/core';

// === Игровой движок =========================================================
export {
  makeLangtonState,
  stepLangton,
  type SimState,
  type Ant,
} from './langton/engine';

export {
  LA_RULES,
  LA_DIRS,
  parseRule,
} from './langton/rules';

export {
  mulberry32,
  type PRNG,
} from './langton/prng';

// === Сетевой протокол =======================================================
export {
  encodeMessage,
  decodeMessage,
  type WsMessage,
  type ClientToServer,
  type ServerToClient,
} from './protocol/messages';

export {
  validateMessage,
} from './protocol/schema';

// === Контракт интерфейса ====================================================
export type {
  AppState,
  ConnectionState,
  User,
  ServiceStatus,
  Locale,
  ScreenId,
  MatchState,
  MatchPlayer,
  LeaderboardRow,
  LobbyState,
  MatchmakingState,
  ProfileState,
  SettingsState,
} from './contract/state';

export type {
  AppActions,
  ActionResult,
} from './contract/actions';

export type {
  GameEvent,
  MatchEvent,
  MatchEventType,
} from './contract/events';

// === Константы и форматтеры =================================================
export {
  PLAYER_PALETTE,
  RULES_REGISTRY,
  RANK_TIERS,
  rankFromSr,
} from './shared/constants';

export {
  formatTimer,
  formatPercent,
  formatLargeNumber,
  formatRelativeTime,
} from './shared/formatting';
