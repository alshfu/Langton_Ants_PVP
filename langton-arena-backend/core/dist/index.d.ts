export { makeLangtonState, stepLangton, } from './langton/engine';
export type { SimState, Ant, BirthConfig, StepEvents, MakeStateConfig, Topology, } from './langton/engine';
export { LA_RULES, LA_DIRS, parseRule, } from './langton/rules';
export { getNeighbors, getNumDirs, applyRuleChar, } from './langton/grid';
export type { GridType as EngineGridType } from './langton/grid';
export { mulberry32, } from './langton/prng';
export type { PRNG } from './langton/prng';
export type { AppState, ScreenId, LocaleCode, User, SpawnPattern, Topology as ContractTopology, // alias чтобы не дублироваться с engine.Topology
GridType, // Stage 8 multi-grid
SandboxMode, SandboxAntConfig, SandboxPlayerConfig, SandboxConfig, SandboxRuntimeState, BuiltinPreset, UserPreset, PlayerLiveStats, SandboxLiveStats, LogEvent, LogEventType, Highlight, HighlightType, WinCondition, WinConditionKind, MatchResult, MutationConfig, } from './contract/state';
export type { Replay, ReplayMetadata, DeployAction, } from './contract/replay';
export { REPLAY_FORMAT_VERSION, } from './contract/replay';
export { buildAntsFromConfig, buildBirthConfig, } from './lib/buildEngineState';
export { applyDeployAction, } from './lib/applyDeploy';
export { computeTerritory, computeWinnerByTerritory, } from './lib/computeTerritory';
export type { TerritoryEntry, PlayerRef, } from './lib/computeTerritory';
export { buildReplayFromMatch, } from './lib/buildReplay';
export type { BuildReplayArgs, } from './lib/buildReplay';
export { SlidingWindowLimiter, RATE_LIMITS, } from './lib/rateLimit';
export type { RateLimitConfig, } from './lib/rateLimit';
export { canDeploy, } from './lib/deployValidation';
export type { DeployRule, DeployConfig, DeployValidation, } from './lib/deployValidation';
export { ERROR_CODES, isClientMessage, } from './protocol/stage8';
export type { PlayerInfo, ClientMessage, ClientMessageType, ServerMessage, ServerMessageType, ErrorCode, } from './protocol/stage8';
//# sourceMappingURL=index.d.ts.map