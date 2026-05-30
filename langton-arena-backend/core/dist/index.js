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
export { makeLangtonState, stepLangton, } from './langton/engine';
export { LA_RULES, LA_DIRS, parseRule, } from './langton/rules';
export { getNeighbors, getNumDirs, applyRuleChar, } from './langton/grid';
export { mulberry32, } from './langton/prng';
export { REPLAY_FORMAT_VERSION, } from './contract/replay';
// === Build engine state (shared client + server) ============================
export { buildAntsFromConfig, buildBirthConfig, } from './lib/buildEngineState';
// === Apply deploy action (shared client + server) ===========================
export { applyDeployAction, } from './lib/applyDeploy';
// === Compute territory + winner (Day 11) ====================================
export { computeTerritory, computeWinnerByTerritory, } from './lib/computeTerritory';
// === Build replay from match (Day 12) =======================================
export { buildReplayFromMatch, } from './lib/buildReplay';
// === Rate limiting (Day 14) =================================================
export { SlidingWindowLimiter, RATE_LIMITS, } from './lib/rateLimit';
// === Deploy validation (shared client + server) =============================
export { canDeploy, } from './lib/deployValidation';
// === Stage 8 WebSocket protocol (shared client + server) ====================
// NOTE: DeployAction уже экспортируется из './contract/replay' выше,
// поэтому из './protocol/stage8' экспортируем под алиасом DeployActionWS.
// На практике это тот же type — обе ветки используют одинаковую shape.
export { ERROR_CODES, isClientMessage, } from './protocol/stage8';
//# sourceMappingURL=index.js.map